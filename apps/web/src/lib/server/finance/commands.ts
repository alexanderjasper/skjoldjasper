import {createHash} from 'crypto';
import type {BudgetState, DuplicateWarning} from './types';
import type {
    BudgetCreated,
    CategoryAdded,
    CategoryTargetSet,
    MemberAdded,
    TransactionNoteAdded,
    TransactionsImported,
    TransactionSplitAssigned
} from './events';

export function createBudget(name: string, currency: string, userId: string): BudgetCreated {
    return {name, currency, creatorUserId: userId};
}

export function addMember(state: BudgetState, userId: string): MemberAdded | null {
    if (state.members.has(userId)) return null;
    return {userId};
}

export function addCategory(
    state: BudgetState,
    categoryId: string,
    name: string,
    parentId: string | null
): CategoryAdded {
    if (state.categories.has(categoryId)) {
        throw new Error('Category already exists');
    }
    if (parentId && !state.categories.has(parentId)) {
        throw new Error('Parent category does not exist');
    }
    return {categoryId, name, parentId};
}

export function setCategoryTarget(
    state: BudgetState,
    categoryId: string,
    yearlyTarget: number
): CategoryTargetSet {
    if (!state.categories.has(categoryId)) {
        throw new Error('Category does not exist');
    }

    // Check if this category has children - only leaf categories can have targets
    const category = state.categories.get(categoryId);
    if (!category) {
        throw new Error('Category does not exist');
    }

    // Check if any category has this as a parent
    for (const [id, cat] of state.categories.entries()) {
        if (cat.parentId === categoryId) {
            throw new Error('Cannot set target on parent category. Only leaf categories can have targets.');
        }
    }

    return {categoryId, yearlyTarget};
}

export function generateTransactionId(date: string, description: string, amount: number): string {
    const hash = createHash('sha256');
    hash.update(`${date}|${description}|${amount}`);
    return hash.digest('hex').substring(0, 16);
}

export function importTransactions(
    state: BudgetState,
    transactions: Array<{ date: string; description: string; amount: number }>
): { event: TransactionsImported; duplicates: DuplicateWarning[] } {
    const txsWithIds = transactions.map((tx) => ({
        transactionId: generateTransactionId(tx.date, tx.description, tx.amount),
        date: tx.date,
        description: tx.description,
        amount: tx.amount
    }));

    const duplicates: DuplicateWarning[] = [];
    const newTransactions = [];

    for (const tx of txsWithIds) {
        if (state.transactions.has(tx.transactionId)) {
            duplicates.push(tx);
        } else {
            newTransactions.push(tx);
        }
    }

    return {
        event: {transactions: newTransactions},
        duplicates
    };
}

export function assignSplits(
    state: BudgetState,
    transactionId: string,
    splits: Array<{ categoryId: string; amount: number }>
): TransactionSplitAssigned {
    const transaction = state.transactions.get(transactionId);
    if (!transaction) {
        throw new Error('Transaction does not exist');
    }

    for (const split of splits) {
        if (!state.categories.has(split.categoryId)) {
            throw new Error(`Category ${split.categoryId} does not exist`);
        }
    }

    const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
    const epsilon = 0.01;
    if (Math.abs(totalSplit - transaction.amount) > epsilon) {
        throw new Error(
            `Splits total ${totalSplit} does not match transaction amount ${transaction.amount}`
        );
    }

    return {transactionId, splits};
}

export function addNote(state: BudgetState, transactionId: string, note: string): TransactionNoteAdded {
    if (!state.transactions.has(transactionId)) {
        throw new Error('Transaction does not exist');
    }
    return {transactionId, note};
}

