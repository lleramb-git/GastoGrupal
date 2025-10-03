import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { startOfDay, endOfDay } from "date-fns";

import { 
  type User, 
  type InsertUser,
  type Expense,
  type InsertExpense,
  type ExpenseParticipant,
  type ExpenseWithDetails,
  type DebtSummary,
  type Payment,
  type InsertPayment,
  type PaymentWithDetails
} from "@shared/schema";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  toggleUserActive(id: string): Promise<User>;
  
  // Expenses  
  getExpensesByDate(date: Date): Promise<ExpenseWithDetails[]>;
  getExpensesByDateRange(startDate: Date, endDate: Date): Promise<ExpenseWithDetails[]>;
  getAllExpenses(filters?: ExpenseFilters): Promise<ExpenseWithDetails[]>;
  getExpenseById(id: string): Promise<ExpenseWithDetails | null>;
  createExpense(expense: InsertExpense, participants: { userId: string; amount: string }[]): Promise<ExpenseWithDetails>;
  updateExpense(id: string, expense: Partial<InsertExpense>, participants?: { userId: string; amount: string }[]): Promise<ExpenseWithDetails>;
  deleteExpense(id: string): Promise<void>;
  
  // Payments/Settlements
  getPayments(): Promise<PaymentWithDetails[]>;
  createPayment(payment: { fromUserId: string; toUserId: string; amount: string; description?: string; paymentDate?: Date }): Promise<Payment>;
  deletePayment(id: string): Promise<void>;
  
  // Debt calculations
  getDebtSummary(): Promise<DebtSummary[]>;
  getSimplifiedDebts(): Promise<DebtSummary[]>;
  
  // Statistics
  getTotalSpent(): Promise<string>;
  getMonthlyExpenseCount(year: number, month: number): Promise<number>;
}

export interface ExpenseFilters {
  startDate?: Date;
  endDate?: Date;
  payerId?: string;
  participantId?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}

class SupabaseStorage implements IStorage {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getUsers(): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createUser(user: InsertUser): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .insert([user])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update(user)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async toggleUserActive(id: string): Promise<User> {
    // First get the current state
    const { data: currentUser, error: fetchError } = await this.supabase
      .from('users')
      .select('active')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Toggle the active state
    const { data, error } = await this.supabase
      .from('users')
      .update({ active: currentUser.active ? 0 : 1 })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getExpensesByDate(date: Date): Promise<ExpenseWithDetails[]> {
    const startDate = startOfDay(date);
    const endDate = endOfDay(date);
    
    return await this.getExpensesByDateRange(startDate, endDate);
  }

  async getExpensesByDateRange(startDate: Date, endDate: Date): Promise<ExpenseWithDetails[]> {
    const { data: expenses, error } = await this.supabase
      .from('expenses')
      .select(`
        *,
        payer:users!payer_id(*)
      `)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: false });

    if (error) throw error;

    // Get participants for each expense
    const expenseDetails: ExpenseWithDetails[] = [];
    
    for (const expense of expenses || []) {
      const { data: participants, error: participantsError } = await this.supabase
        .from('expense_participants')
        .select(`
          *,
          user:users(*)
        `)
        .eq('expense_id', expense.id);

      if (participantsError) throw participantsError;

      expenseDetails.push({
        ...expense,
        participants: participants || [],
      });
    }

    return expenseDetails;
  }

  async getAllExpenses(filters?: ExpenseFilters): Promise<ExpenseWithDetails[]> {
    let query = this.supabase
      .from('expenses')
      .select(`
        *,
        payer:users!payer_id(*)
      `)
      .order('date', { ascending: false });

    // Apply filters
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate.toISOString());
    }
    if (filters?.payerId) {
      query = query.eq('payer_id', filters.payerId);
    }
    if (filters?.minAmount) {
      query = query.gte('amount', filters.minAmount);
    }
    if (filters?.maxAmount) {
      query = query.lte('amount', filters.maxAmount);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data: expenses, error } = await query;

    if (error) throw error;

    // Get participants for each expense
    const expenseDetails: ExpenseWithDetails[] = [];
    
    for (const expense of expenses || []) {
      // Filter by participant if specified
      if (filters?.participantId) {
        const { data: hasParticipant } = await this.supabase
          .from('expense_participants')
          .select('id')
          .eq('expense_id', expense.id)
          .eq('user_id', filters.participantId)
          .single();

        if (!hasParticipant) continue;
      }

      const { data: participants, error: participantsError } = await this.supabase
        .from('expense_participants')
        .select(`
          *,
          user:users(*)
        `)
        .eq('expense_id', expense.id);

      if (participantsError) throw participantsError;

      expenseDetails.push({
        ...expense,
        participants: participants || [],
      });
    }

    return expenseDetails;
  }

  async getExpenseById(id: string): Promise<ExpenseWithDetails | null> {
    const { data: expense, error } = await this.supabase
      .from('expenses')
      .select(`
        *,
        payer:users!payer_id(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    const { data: participants, error: participantsError } = await this.supabase
      .from('expense_participants')
      .select(`
        *,
        user:users(*)
      `)
      .eq('expense_id', expense.id);

    if (participantsError) throw participantsError;

    return {
      ...expense,
      participants: participants || [],
    };
  }

  async createExpense(expense: InsertExpense, participants: { userId: string; amount: string }[]): Promise<ExpenseWithDetails> {
    // Insert expense
    const { data: newExpense, error: expenseError } = await this.supabase
      .from('expenses')
      .insert([{
        description: expense.description,
        amount: expense.amount,
        payer_id: expense.payerId,
        date: expense.date,
      }])
      .select()
      .single();

    if (expenseError) throw expenseError;

    // Insert participants
    const participantInserts = participants.map(p => ({
      expense_id: newExpense.id,
      user_id: p.userId,
      amount: p.amount,
    }));

    const { error: participantsError } = await this.supabase
      .from('expense_participants')
      .insert(participantInserts);

    if (participantsError) throw participantsError;

    // Get the complete expense with details
    const expenseWithDetails = await this.getExpenseById(newExpense.id);
    if (!expenseWithDetails) throw new Error('Failed to retrieve created expense');

    return expenseWithDetails;
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>, participants?: { userId: string; amount: string }[]): Promise<ExpenseWithDetails> {
    // Update expense
    const updateData: any = {};
    if (expense.description !== undefined) updateData.description = expense.description;
    if (expense.amount !== undefined) updateData.amount = expense.amount;
    if (expense.payerId !== undefined) updateData.payer_id = expense.payerId;
    if (expense.date !== undefined) updateData.date = expense.date;

    const { error: expenseError } = await this.supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id);

    if (expenseError) throw expenseError;

    // Update participants if provided
    if (participants) {
      // Delete existing participants
      const { error: deleteError } = await this.supabase
        .from('expense_participants')
        .delete()
        .eq('expense_id', id);

      if (deleteError) throw deleteError;

      // Insert new participants
      const participantInserts = participants.map(p => ({
        expense_id: id,
        user_id: p.userId,
        amount: p.amount,
      }));

      const { error: insertError } = await this.supabase
        .from('expense_participants')
        .insert(participantInserts);

      if (insertError) throw insertError;
    }

    // Get the updated expense with details
    const expenseWithDetails = await this.getExpenseById(id);
    if (!expenseWithDetails) throw new Error('Failed to retrieve updated expense');

    return expenseWithDetails;
  }

  async deleteExpense(id: string): Promise<void> {
    // The CASCADE delete will handle expense_participants
    const { error } = await this.supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getDebtSummary(): Promise<DebtSummary[]> {
    // Get all users
    const { data: users, error: usersError } = await this.supabase
      .from('users')
      .select('*');

    if (usersError) throw usersError;

    // Calculate balances for each user
    const balances: Map<string, { user: User; balance: number }> = new Map();

    for (const user of users || []) {
      // Total paid by user (expenses)
      const { data: paidExpenses, error: paidError } = await this.supabase
        .from('expenses')
        .select('amount')
        .eq('payer_id', user.id);

      if (paidError) throw paidError;

      const totalPaid = (paidExpenses || []).reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

      // Total owed by user (expense participations)
      const { data: owedParticipations, error: owedError } = await this.supabase
        .from('expense_participants')
        .select('amount')
        .eq('user_id', user.id);

      if (owedError) throw owedError;

      const totalOwed = (owedParticipations || []).reduce((sum, part) => sum + parseFloat(part.amount), 0);

      // Total paid to others (settlements/payments made)
      const { data: paymentsMade, error: paymentsMadeError } = await this.supabase
        .from('payments')
        .select('amount')
        .eq('from_user_id', user.id);

      if (paymentsMadeError) throw paymentsMadeError;

      const totalPaymentsMade = (paymentsMade || []).reduce((sum, pay) => sum + parseFloat(pay.amount), 0);

      // Total received from others (settlements/payments received)
      const { data: paymentsReceived, error: paymentsReceivedError } = await this.supabase
        .from('payments')
        .select('amount')
        .eq('to_user_id', user.id);

      if (paymentsReceivedError) throw paymentsReceivedError;

      const totalPaymentsReceived = (paymentsReceived || []).reduce((sum, pay) => sum + parseFloat(pay.amount), 0);

      // Balance calculation:
      // - totalPaid: money they paid for expenses (positive balance)
      // - totalOwed: money they owe from their share of expenses (negative balance)
      // - totalPaymentsMade: payments they made to settle debts (reduces their debt, so it's positive)
      // - totalPaymentsReceived: payments they received (reduces what others owe them, so it's negative)
      // Formula: what_they_are_owed - what_they_owe
      // what_they_are_owed = totalPaid - totalPaymentsReceived
      // what_they_owe = totalOwed - totalPaymentsMade
      balances.set(user.id, {
        user,
        balance: (totalPaid - totalPaymentsReceived) - (totalOwed - totalPaymentsMade),
      });
    }

    // Separate creditors (positive balance) and debtors (negative balance)
    const creditors: Array<{ user: User; amount: number }> = [];
    const debtors: Array<{ user: User; amount: number }> = [];

    balances.forEach(({ user, balance }) => {
      if (balance > 0.01) {
        creditors.push({ user, amount: balance });
      } else if (balance < -0.01) {
        debtors.push({ user, amount: Math.abs(balance) });
      }
    });

    // Calculate debts using greedy algorithm
    const debts: DebtSummary[] = [];
    
    for (const debtor of debtors) {
      let remainingDebt = debtor.amount;
      
      for (const creditor of creditors) {
        if (remainingDebt <= 0.01 || creditor.amount <= 0.01) continue;
        
        const payment = Math.min(remainingDebt, creditor.amount);
        
        debts.push({
          debtor: debtor.user,
          creditor: creditor.user,
          amount: payment.toFixed(2),
        });
        
        remainingDebt -= payment;
        creditor.amount -= payment;
      }
    }

    return debts;
  }

  async getSimplifiedDebts(): Promise<DebtSummary[]> {
    // Get all users
    const { data: users, error: usersError } = await this.supabase
      .from('users')
      .select('*');

    if (usersError) throw usersError;

    // Calculate net balances
    const balances: Map<string, { user: User; balance: number }> = new Map();

    for (const user of users || []) {
      const { data: paidExpenses, error: paidError } = await this.supabase
        .from('expenses')
        .select('amount')
        .eq('payer_id', user.id);

      if (paidError) throw paidError;

      const totalPaid = (paidExpenses || []).reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

      const { data: owedParticipations, error: owedError } = await this.supabase
        .from('expense_participants')
        .select('amount')
        .eq('user_id', user.id);

      if (owedError) throw owedError;

      const totalOwed = (owedParticipations || []).reduce((sum, part) => sum + parseFloat(part.amount), 0);

      balances.set(user.id, {
        user,
        balance: totalPaid - totalOwed,
      });
    }

    // Separate creditors and debtors
    const creditors: Array<{ user: User; amount: number }> = [];
    const debtors: Array<{ user: User; amount: number }> = [];

    balances.forEach(({ user, balance }) => {
      if (balance > 0.01) {
        creditors.push({ user, amount: balance });
      } else if (balance < -0.01) {
        debtors.push({ user, amount: Math.abs(balance) });
      }
    });

    // Sort by amount (descending)
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // Greedy algorithm to minimize transactions
    const simplifiedDebts: DebtSummary[] = [];
    let i = 0, j = 0;

    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      
      const amount = Math.min(creditor.amount, debtor.amount);
      
      simplifiedDebts.push({
        debtor: debtor.user,
        creditor: creditor.user,
        amount: amount.toFixed(2),
      });

      creditor.amount -= amount;
      debtor.amount -= amount;

      if (creditor.amount < 0.01) i++;
      if (debtor.amount < 0.01) j++;
    }

    return simplifiedDebts;
  }

  async getTotalSpent(): Promise<string> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select('amount');

    if (error) throw error;

    const total = (data || []).reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    return total.toFixed(2);
  }

  async getMonthlyExpenseCount(year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data, error } = await this.supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (error) throw error;

    return data?.length || 0;
  }

  async getPayments(): Promise<PaymentWithDetails[]> {
    const { data: payments, error } = await this.supabase
      .from('payments')
      .select(`
        *,
        fromUser:users!from_user_id(*),
        toUser:users!to_user_id(*)
      `)
      .order('payment_date', { ascending: false });

    if (error) throw error;

    return payments || [];
  }

  async createPayment(payment: { fromUserId: string; toUserId: string; amount: string; description?: string; paymentDate?: Date }): Promise<Payment> {
    const { data, error } = await this.supabase
      .from('payments')
      .insert([{
        from_user_id: payment.fromUserId,
        to_user_id: payment.toUserId,
        amount: payment.amount,
        description: payment.description || null,
        payment_date: payment.paymentDate?.toISOString() || new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deletePayment(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const storage = new SupabaseStorage();
