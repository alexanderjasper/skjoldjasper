import {Client} from 'pg';
import type {EventRow, ProjectorHandler} from '../../runner';

// Plain JSON-friendly state for snapshots
type Category = {
    id: string;
    name: string;
    parentId: string | null;
    type: 'income' | 'expense' | 'savings';
    target?: { amount: number; period: 'monthly' | 'yearly' }
};
type Transaction = { id: string; date: string; description: string; amount: number };

type BudgetSnapshotState = {
    name: string;
    currency: string;
    creatorUserId: string;
    members: string[];
    categories: Record<string, Category>;
    transactions: Record<string, Transaction>;
    splits: Record<string, Array<{ categoryId: string; amount: number }>>;
    notes: Record<string, string>;
    savingGoals: Record<string, {
        id: string;
        name: string;
        targetAmount: number;
        targetDate: string | null;
        categoryId: string | null
    }>;
    accounts: Record<string, {
        id: string;
        name: string;
        balance: number;
        lastUpdated: string
    }>;
    version: number;
};

export const handlerName = 'finance_budget';

async function ensureSchema(_client: Client): Promise<void> {
    // No-op: snapshots table exists in core schema (packages/db)
}

const stateCache = new Map<string, { state: BudgetSnapshotState; version: number }>();

function createEmptyState(): BudgetSnapshotState {
    return {
        name: '',
        currency: '',
        creatorUserId: '',
        members: [],
        categories: {},
        transactions: {},
        splits: {},
        notes: {},
        savingGoals: {},
        accounts: {},
        version: 0
    };
}

function applyEvent(state: BudgetSnapshotState, type: string, payload: any): void {
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
            const c: Category = {
                id: payload.categoryId,
                name: payload.name,
                parentId: payload.parentId ?? null,
                type: payload.type || 'expense'
            };
            state.categories[c.id] = c;
            break;
        }
        case 'CategoryTargetSet': {
            const {categoryId, amount, period} = payload as {
                categoryId: string;
                amount: number;
                period?: 'monthly' | 'yearly'
            };
            const c = state.categories[categoryId];
            if (c) {
                c.target = {amount, period: period || 'monthly'};
            }
            break;
        }
        case 'SavingGoalCreated': {
            state.savingGoals[payload.goalId] = {
                id: payload.goalId,
                name: payload.name,
                targetAmount: payload.targetAmount,
                targetDate: payload.targetDate,
                categoryId: payload.categoryId
            };
            break;
        }
        case 'AccountBalanceAdjusted': {
            state.accounts[payload.accountId] = {
                id: payload.accountId,
                name: payload.name,
                balance: payload.balance,
                lastUpdated: payload.date
            };
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

async function loadLatestSnapshot(client: Client, streamId: string): Promise<{
    state: BudgetSnapshotState;
    version: number
}> {
    const cached = stateCache.get(streamId);
    if (cached) return cached;

    const {rows} = await client.query(
        `SELECT version, payload
         FROM aggregate_snapshots
         WHERE context = $1
           AND stream_category = $2
           AND stream_id = $3
         ORDER BY version DESC LIMIT 1`,
        ['finance', 'budget', streamId]
    );

    if (rows.length === 0) {
        const fresh = {state: createEmptyState(), version: 0} as const;
        stateCache.set(streamId, fresh);
        return fresh;
    }

    const row = rows[0] as { version: number; payload: any };
    const state: BudgetSnapshotState = row.payload as BudgetSnapshotState;
    const loaded = {state, version: Number(row.version ?? 0)} as const;
    stateCache.set(streamId, loaded);
    return loaded;
}

async function writeSnapshot(client: Client, streamId: string, version: number, state: BudgetSnapshotState): Promise<void> {
    await client.query(
        `INSERT INTO aggregate_snapshots (context, stream_category, stream_id, version, payload)
         VALUES ($1, $2, $3, $4,
                 $5::jsonb) ON CONFLICT (context, stream_category, stream_id, version) DO NOTHING`,
        ['finance', 'budget', streamId, version, JSON.stringify(state)]
    );
}

async function apply(ev: EventRow, client: Client): Promise<void> {
    const {state, version} = await loadLatestSnapshot(client, ev.stream_id);
    applyEvent(state, ev.type, ev.payload);
    const nextVersion = version + 1;
    state.version = nextVersion;
    await writeSnapshot(client, ev.stream_id, nextVersion, state);
    stateCache.set(ev.stream_id, {state, version: nextVersion});
}

export const financeBudgetHandler: ProjectorHandler = {
    handlerName,
    context: 'finance',
    streamCategory: 'budget',
    ensureSchema,
    apply
};
