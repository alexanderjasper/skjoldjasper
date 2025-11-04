import { z } from 'zod';

export const BudgetCreatedSchema = z.object({
  name: z.string(),
  currency: z.string(),
  creatorUserId: z.string()
});

export const CategoryAddedSchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  parentId: z.string().nullable()
});

export const CategoryTargetSetSchema = z.object({
  categoryId: z.string(),
  yearlyTarget: z.number()
});

export const TransactionsImportedSchema = z.object({
  transactions: z.array(z.object({
    transactionId: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number()
  }))
});

export const TransactionSplitAssignedSchema = z.object({
  transactionId: z.string(),
  splits: z.array(z.object({
    categoryId: z.string(),
    amount: z.number()
  }))
});

export const TransactionNoteAddedSchema = z.object({
  transactionId: z.string(),
  note: z.string()
});

export const MemberAddedSchema = z.object({
  userId: z.string()
});

export type BudgetCreated = z.infer<typeof BudgetCreatedSchema>;
export type CategoryAdded = z.infer<typeof CategoryAddedSchema>;
export type CategoryTargetSet = z.infer<typeof CategoryTargetSetSchema>;
export type TransactionsImported = z.infer<typeof TransactionsImportedSchema>;
export type TransactionSplitAssigned = z.infer<typeof TransactionSplitAssignedSchema>;
export type TransactionNoteAdded = z.infer<typeof TransactionNoteAddedSchema>;
export type MemberAdded = z.infer<typeof MemberAddedSchema>;

