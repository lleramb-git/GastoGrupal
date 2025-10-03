import { apiRequest } from "./queryClient";

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
  createdAt: string;
}

export interface ExpenseParticipant {
  id: string;
  expenseId: string;
  userId: string;
  amount: string;
  user: User;
}

export interface Expense {
  id: string;
  description: string;
  amount: string;
  payerId: string;
  date: string;
  createdAt: string;
  payer: User;
  participants: ExpenseParticipant[];
}

export interface DebtSummary {
  debtor: User;
  creditor: User;
  amount: string;
}

export interface Stats {
  totalSpent: string;
  monthlyExpenses: number;
}

// Initialize users on app start
export const initializeApp = async (): Promise<{ users: User[] }> => {
  const response = await apiRequest("POST", "/api/initialize");
  return response.json();
};

export const getUsers = async (): Promise<User[]> => {
  const response = await apiRequest("GET", "/api/users");
  return response.json();
};

export const getExpensesByDate = async (date: string): Promise<Expense[]> => {
  const response = await apiRequest("GET", `/api/expenses?date=${date}`);
  return response.json();
};

export const createExpense = async (expenseData: {
  description: string;
  amount: string;
  payerId: string;
  date: string;
  participants: { userId: string; amount: string }[];
}): Promise<Expense> => {
  const response = await apiRequest("POST", "/api/expenses", expenseData);
  return response.json();
};

export const getDebts = async (): Promise<DebtSummary[]> => {
  const response = await apiRequest("GET", "/api/debts");
  return response.json();
};

export const getStats = async (year?: number, month?: number): Promise<Stats> => {
  const params = new URLSearchParams();
  if (year) params.append("year", year.toString());
  if (month) params.append("month", month.toString());
  
  const response = await apiRequest("GET", `/api/stats${params.toString() ? `?${params}` : ""}`);
  return response.json();
};
