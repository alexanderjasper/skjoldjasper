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

export interface BudgetState {
  name: string;
  currency: string;
  creatorUserId: string;
  members: Set<string>;
  categories: Map<string, Category>;
  transactions: Map<string, Transaction>;
  splits: Map<string, TransactionSplit[]>;
  notes: Map<string, string>;
  version: number;
}

export interface DuplicateWarning {
  transactionId: string;
  date: string;
  description: string;
  amount: number;
}

