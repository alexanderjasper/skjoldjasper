export interface Category {
    id: string;
    name: string;
    parentId: string | null;
    yearlyTarget?: number;
}

export interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
}

export interface TransactionSplit {
    categoryId: string;
    amount: number;
}

export interface DuplicateWarning {
    transactionId: string;
    date: string;
    description: string;
    amount: number;
}

