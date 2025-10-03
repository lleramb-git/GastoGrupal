import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, json, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  color: text("color").notNull().default("#3B82F6"),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  payerId: uuid("payer_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenseParticipants = pgTable("expense_participants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: uuid("expense_id").references(() => expenses.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: uuid("from_user_id").references(() => users.id).notNull(),
  toUserId: uuid("to_user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  initials: true,
  color: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).pick({
  description: true,
  amount: true,
  payerId: true,
  date: true,
}).extend({
  date: z.union([z.date(), z.string().transform((val) => new Date(val))]),
});

export const insertExpenseParticipantSchema = createInsertSchema(expenseParticipants).pick({
  expenseId: true,
  userId: true,
  amount: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type ExpenseParticipant = typeof expenseParticipants.$inferSelect;
export type InsertExpenseParticipant = z.infer<typeof insertExpenseParticipantSchema>;

export interface ExpenseWithDetails extends Expense {
  payer: User;
  participants: (ExpenseParticipant & { user: User })[];
}

export const insertPaymentSchema = createInsertSchema(payments).pick({
  fromUserId: true,
  toUserId: true,
  amount: true,
  description: true,
  paymentDate: true,
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export interface PaymentWithDetails extends Payment {
  fromUser: User;
  toUser: User;
}

export interface DebtSummary {
  debtor: User;
  creditor: User;
  amount: string;
}
