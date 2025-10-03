import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { format, startOfDay, endOfDay } from "date-fns";

import { 
  users, 
  expenses, 
  expenseParticipants,
  type User, 
  type InsertUser,
  type Expense,
  type InsertExpense,
  type ExpenseParticipant,
  type InsertExpenseParticipant,
  type ExpenseWithDetails,
  type DebtSummary
} from "@shared/schema";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // Expenses  
  getExpensesByDate(date: Date): Promise<ExpenseWithDetails[]>;
  getExpensesByDateRange(startDate: Date, endDate: Date): Promise<ExpenseWithDetails[]>;
  createExpense(expense: InsertExpense, participants: { userId: string; amount: string }[]): Promise<ExpenseWithDetails>;
  
  // Debt calculations
  getDebtSummary(): Promise<DebtSummary[]>;
  
  // Statistics
  getTotalSpent(): Promise<string>;
  getMonthlyExpenseCount(year: number, month: number): Promise<number>;
}

class DatabaseStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    const sql = neon(process.env.DATABASE_URL, {
      fetchOptions: {
        cache: 'no-store',
      },
    });
    this.db = drizzle(sql);
  }

  async getUsers(): Promise<User[]> {
    return await this.db.select().from(users).orderBy(users.name);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await this.db.insert(users).values(user).returning();
    return newUser;
  }

  async getExpensesByDate(date: Date): Promise<ExpenseWithDetails[]> {
    const startDate = startOfDay(date);
    const endDate = endOfDay(date);
    
    return await this.getExpensesByDateRange(startDate, endDate);
  }

  async getExpensesByDateRange(startDate: Date, endDate: Date): Promise<ExpenseWithDetails[]> {
    const expenseResults = await this.db
      .select({
        expense: expenses,
        payer: users,
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.payerId, users.id))
      .where(and(
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      ))
      .orderBy(expenses.date);

    const expenseDetails: ExpenseWithDetails[] = [];

    for (const result of expenseResults) {
      if (!result.expense || !result.payer) continue;

      const participantResults = await this.db
        .select({
          participant: expenseParticipants,
          user: users,
        })
        .from(expenseParticipants)
        .leftJoin(users, eq(expenseParticipants.userId, users.id))
        .where(eq(expenseParticipants.expenseId, result.expense.id));

      const participants = participantResults
        .filter(p => p.participant && p.user)
        .map(p => ({
          ...p.participant!,
          user: p.user!,
        }));

      expenseDetails.push({
        ...result.expense,
        payer: result.payer,
        participants,
      });
    }

    return expenseDetails;
  }

  async createExpense(expense: InsertExpense, participants: { userId: string; amount: string }[]): Promise<ExpenseWithDetails> {
    const [newExpense] = await this.db.insert(expenses).values(expense).returning();

    // Insert participants
    const participantInserts = participants.map(p => ({
      expenseId: newExpense.id,
      userId: p.userId,
      amount: p.amount,
    }));

    await this.db.insert(expenseParticipants).values(participantInserts);

    // Get the complete expense with details
    const [expenseWithDetails] = await this.getExpensesByDateRange(
      new Date(newExpense.date),
      new Date(newExpense.date)
    );

    return expenseWithDetails;
  }

  async getDebtSummary(): Promise<DebtSummary[]> {
    // Calculate net balances for each user
    const balances = await this.db
      .select({
        userId: users.id,
        user: users,
        totalPaid: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        totalOwed: sql<string>`COALESCE(SUM(${expenseParticipants.amount}), 0)`,
      })
      .from(users)
      .leftJoin(expenses, eq(users.id, expenses.payerId))
      .leftJoin(expenseParticipants, eq(users.id, expenseParticipants.userId))
      .groupBy(users.id, users.name, users.initials, users.color, users.createdAt);

    // Calculate debts between users
    const debts: DebtSummary[] = [];
    
    for (let i = 0; i < balances.length; i++) {
      for (let j = i + 1; j < balances.length; j++) {
        const user1 = balances[i];
        const user2 = balances[j];
        
        const user1Balance = parseFloat(user1.totalPaid) - parseFloat(user1.totalOwed);
        const user2Balance = parseFloat(user2.totalPaid) - parseFloat(user2.totalOwed);
        
        if (user1Balance > 0 && user2Balance < 0) {
          const amount = Math.min(user1Balance, Math.abs(user2Balance));
          if (amount > 0) {
            debts.push({
              debtor: user2.user,
              creditor: user1.user,
              amount: amount.toFixed(2),
            });
          }
        } else if (user2Balance > 0 && user1Balance < 0) {
          const amount = Math.min(user2Balance, Math.abs(user1Balance));
          if (amount > 0) {
            debts.push({
              debtor: user1.user,
              creditor: user2.user,
              amount: amount.toFixed(2),
            });
          }
        }
      }
    }

    return debts;
  }

  async getTotalSpent(): Promise<string> {
    const result = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      })
      .from(expenses);

    return result[0]?.total || "0";
  }

  async getMonthlyExpenseCount(year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await this.db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(expenses)
      .where(and(
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      ));

    return result[0]?.count || 0;
  }
}

export const storage = new DatabaseStorage();
