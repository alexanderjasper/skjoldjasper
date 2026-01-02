import type {Pool} from 'pg';

export interface BudgetSummary {
    streamId: string;
    name: string;
    currency: string;
    createdAt: Date;
}

export interface BudgetSnapshotState {
    name: string;
    currency: string;
    creatorUserId: string;
    members: string[];
    categories: Record<string, {
        id: string;
        name: string;
        parentId: string | null;
        yearlyTarget?: number
    }>;
    transactions: Record<string, { id: string; date: string; description: string; amount: number }>;
    splits: Record<string, Array<{ categoryId: string; amount: number }>>;
    notes: Record<string, string>;
    version: number;
}

export interface CategoryActual {
    categoryId: string;
    categoryName: string;
    parentId: string | null;
    yearlyTarget?: number;
    actualSpent: number;
}

async function getLatestSnapshots(pool: Pool) {
    const {rows} = await pool.query(
        `SELECT DISTINCT
         ON (stream_id)
             stream_id,
             payload,
             created_at
         FROM aggregate_snapshots
         WHERE context = 'finance' AND stream_category = 'budget'
         ORDER BY stream_id, version DESC`
    );
    return rows as Array<{ stream_id: string; payload: any; created_at: Date }>;
}

export async function getBudgetsForUser(pool: Pool, userId: string): Promise<BudgetSummary[]> {
    const rows = await getLatestSnapshots(pool);
    const snapshotResults: BudgetSummary[] = [];
    const seenStreamIds = new Set<string>();

    for (const r of rows) {
        const state = r.payload as BudgetSnapshotState;
        if (Array.isArray(state.members) && state.members.includes(userId)) {
            snapshotResults.push({
                streamId: r.stream_id,
                name: state.name,
                currency: state.currency,
                createdAt: r.created_at
            });
            seenStreamIds.add(r.stream_id);
        }
    }

    const {rows: eventRows} = await pool.query(
        `SELECT DISTINCT stream_id
         FROM events
         WHERE context = 'finance'
           AND stream_category = 'budget'`
    );

    for (const eventRow of eventRows) {
        const streamId = eventRow.stream_id as string;
        if (!seenStreamIds.has(streamId)) {
            const rebuilt = await buildStateFromEvents(pool, streamId);
            if (rebuilt && Array.isArray(rebuilt.state.members) && rebuilt.state.members.includes(userId)) {
                snapshotResults.push({
                    streamId,
                    name: rebuilt.state.name,
                    currency: rebuilt.state.currency,
                    createdAt: rebuilt.createdAt
                });
            }
        }
    }

    return snapshotResults;
}

function applyEventToState(state: BudgetSnapshotState, type: string, payload: any): void {
    // Ensure all state collections are initialized (might be missing in old snapshots)
    if (!state.categories) state.categories = {};
    if (!state.transactions) state.transactions = {};
    if (!state.splits) state.splits = {};
    if (!state.notes) state.notes = {};
    if (!state.savingGoals) state.savingGoals = {};
    if (!state.accounts) state.accounts = {};
    if (!state.members) state.members = [];

    switch (type) {
        case 'BudgetCreated': {
            state.name = payload.name;
            state.currency = payload.currency;
            state.creatorUserId = payload.creatorUserId;
            if (!state.members.includes(payload.creatorUserId)) state.members.push(payload.creatorUserId);
            break;
        }
        case 'MemberAdded': {
            const userId: string = payload.userId;
            if (!state.members.includes(userId)) state.members.push(userId);
            break;
        }
        case 'CategoryAdded': {
            const c = {
                id: payload.categoryId,
                name: payload.name,
                parentId: payload.parentId ?? null
            };
            state.categories[c.id] = c;
            break;
        }
        case 'CategoryTargetSet': {
            const {categoryId, yearlyTarget} = payload as {
                categoryId: string;
                yearlyTarget: number
            };
            const c = state.categories[categoryId];
            if (c) c.yearlyTarget = yearlyTarget;
            break;
        }
        case 'TransactionsImported': {
            const txs = (payload.transactions ?? []) as Array<{
                transactionId: string;
                date: string;
                description: string;
                amount: number
            }>;
            for (const t of txs) {
                state.transactions[t.transactionId] = {
                    id: t.transactionId,
                    date: t.date,
                    description: t.description,
                    amount: t.amount
                };
            }
            break;
        }
        case 'TransactionSplitAssigned': {
            const {transactionId, splits} = payload as {
                transactionId: string;
                splits: Array<{ categoryId: string; amount: number }>
            };
            state.splits[transactionId] = splits;
            break;
        }
        case 'TransactionNoteAdded': {
            const {transactionId, note} = payload as { transactionId: string; note: string };
            state.notes[transactionId] = note;
            break;
        }
    }
}

async function buildStateFromEvents(pool: Pool, budgetId: string): Promise<{
    state: BudgetSnapshotState;
    createdAt: Date
} | null> {
    const {rows} = await pool.query(
        `SELECT type, payload, created_at, version
         FROM events
         WHERE context = 'finance'
           AND stream_category = 'budget'
           AND stream_id = $1
         ORDER BY position ASC`,
        [budgetId]
    );

    if (rows.length === 0) return null;

    const state: BudgetSnapshotState = {
        name: '',
        currency: '',
        creatorUserId: '',
        members: [],
        categories: {},
        transactions: {},
        splits: {},
        notes: {},
        version: rows.length
    };

    for (const row of rows) {
        applyEventToState(state, row.type as string, row.payload);
        state.version = Number(row.version ?? state.version);
    }

    return {state, createdAt: rows[0].created_at as Date};
}

export async function getBudgetDetails(pool: Pool, budgetId: string) {
    const {rows: snapshotRows} = await pool.query(
        `SELECT version, payload, created_at
         FROM aggregate_snapshots
         WHERE context = 'finance'
           AND stream_category = 'budget'
           AND stream_id = $1
         ORDER BY version DESC LIMIT 1`,
        [budgetId]
    );

    let state: BudgetSnapshotState;
    let startVersion = 0;
    let createdAt: Date;

    if (snapshotRows.length === 0) {
        const rebuilt = await buildStateFromEvents(pool, budgetId);
        if (!rebuilt) return null;
        state = rebuilt.state;
        createdAt = rebuilt.createdAt;
        startVersion = state.version;
    } else {
        state = snapshotRows[0].payload as BudgetSnapshotState;
        startVersion = Number(snapshotRows[0].version);
        createdAt = snapshotRows[0].created_at as Date;
    }

    // Load any events after the snapshot
    const {rows: eventRows} = await pool.query(
        `SELECT type, payload, created_at, version
         FROM events
         WHERE context = 'finance'
           AND stream_category = 'budget'
           AND stream_id = $1
           AND version > $2
         ORDER BY version ASC`,
        [budgetId, startVersion]
    );

    for (const row of eventRows) {
        applyEventToState(state, row.type as string, row.payload);
        state.version = Number(row.version);
    }

    return {budgetId, state, createdAt};
}

export async function getBudgetVsActual(pool: Pool, budgetId: string): Promise<CategoryActual[]> {
    const details = await getBudgetDetails(pool, budgetId);
    if (!details) return [];
    const {state} = details;

    const actualByCategory = new Map<string, number>();
    for (const [, splits] of Object.entries(state.splits || {})) {
        for (const split of splits) {
            actualByCategory.set(
                split.categoryId,
                (actualByCategory.get(split.categoryId) ?? 0) + Number(split.amount)
            );
        }
    }

    const results: CategoryActual[] = [];
    for (const [catId, cat] of Object.entries(state.categories || {})) {
        results.push({
            categoryId: catId,
            categoryName: cat.name,
            parentId: cat.parentId,
            yearlyTarget: cat.yearlyTarget,
            actualSpent: actualByCategory.get(catId) ?? 0
        });
    }

    function buildTree(items: CategoryActual[]): CategoryActual[] {
        const itemMap = new Map(items.map(i => [i.categoryId, i]));
        const roots: CategoryActual[] = [];

        function addToTree(item: CategoryActual, result: CategoryActual[]) {
            result.push(item);
            const children = items.filter(i => i.parentId === item.categoryId);
            children.forEach(child => addToTree(child, result));
        }

        items.filter(i => !i.parentId || !itemMap.has(i.parentId)).forEach(root => addToTree(root, roots));
        return roots;
    }

    return buildTree(results);
}

