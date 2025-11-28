import type {BudgetState} from './types';
import type {
    BudgetCreated,
    CategoryAdded,
    CategoryTargetSet,
    MemberAdded,
    TransactionNoteAdded,
    TransactionsImported,
    TransactionSplitAssigned
} from './events';

export function createEmptyState(): BudgetState {
    return {
        name: '',
        currency: '',
        creatorUserId: '',
        members: new Set(),
        categories: new Map(),
        transactions: new Map(),
        splits: new Map(),
        notes: new Map(),
        version: 0
    };
}

export function applyEvent(state: BudgetState, type: string, payload: any, version: number): void {
    switch (type) {
        case 'BudgetCreated': {
            const ev = payload as BudgetCreated;
            state.name = ev.name;
            state.currency = ev.currency;
            state.creatorUserId = ev.creatorUserId;
            state.members.add(ev.creatorUserId);
            break;
        }
        case 'MemberAdded': {
            const ev = payload as MemberAdded;
            state.members.add(ev.userId);
            break;
        }
        case 'CategoryAdded': {
            const ev = payload as CategoryAdded;
            state.categories.set(ev.categoryId, {
                id: ev.categoryId,
                name: ev.name,
                parentId: ev.parentId
            });
            break;
        }
        case 'CategoryTargetSet': {
            const ev = payload as CategoryTargetSet;
            const category = state.categories.get(ev.categoryId);
            if (category) {
                category.yearlyTarget = ev.yearlyTarget;
            }
            break;
        }
        case 'TransactionsImported': {
            const ev = payload as TransactionsImported;
            for (const tx of ev.transactions) {
                state.transactions.set(tx.transactionId, {
                    id: tx.transactionId,
                    date: tx.date,
                    description: tx.description,
                    amount: tx.amount
                });
            }
            break;
        }
        case 'TransactionSplitAssigned': {
            const ev = payload as TransactionSplitAssigned;
            state.splits.set(ev.transactionId, ev.splits);
            break;
        }
        case 'TransactionNoteAdded': {
            const ev = payload as TransactionNoteAdded;
            state.notes.set(ev.transactionId, ev.note);
            break;
        }
    }

    state.version = version;
}

