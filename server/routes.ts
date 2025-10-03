import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertExpenseSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Get expenses by date
  app.get("/api/expenses", async (req, res) => {
    try {
      const { date } = req.query;
      
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date parameter is required" });
      }

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const expenses = await storage.getExpensesByDate(targetDate);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  // Create new expense
  app.post("/api/expenses", async (req, res) => {
    try {
      const expenseValidation = z.object({
        description: z.string().min(1),
        amount: z.string(),
        payerId: z.string(),
        date: z.string(),
        participants: z.array(z.object({
          userId: z.string(),
          amount: z.string(),
        })).min(1, "At least one participant is required"),
      });

      const validatedData = expenseValidation.parse(req.body);
      
      const expense = await storage.createExpense(
        {
          description: validatedData.description,
          amount: validatedData.amount,
          payerId: validatedData.payerId,
          date: new Date(validatedData.date),
        },
        validatedData.participants
      );

      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  // Get debt summary
  app.get("/api/debts", async (req, res) => {
    try {
      const debts = await storage.getDebtSummary();
      res.json(debts);
    } catch (error) {
      console.error("Error fetching debt summary:", error);
      res.status(500).json({ error: "Failed to fetch debt summary" });
    }
  });

  // Get simplified debts
  app.get("/api/debts/simplified", async (req, res) => {
    try {
      const debts = await storage.getSimplifiedDebts();
      res.json(debts);
    } catch (error) {
      console.error("Error calculating simplified debts:", error);
      res.status(500).json({ error: "Failed to calculate simplified debts" });
    }
  });

  // Get all expenses with filters
  app.get("/api/expenses/all", async (req, res) => {
    try {
      const { startDate, endDate, payerId, participantId, minAmount, maxAmount, limit, offset } = req.query;

      const filters: any = {};
      if (startDate && typeof startDate === "string") filters.startDate = new Date(startDate);
      if (endDate && typeof endDate === "string") filters.endDate = new Date(endDate);
      if (payerId && typeof payerId === "string") filters.payerId = payerId;
      if (participantId && typeof participantId === "string") filters.participantId = participantId;
      if (minAmount && typeof minAmount === "string") filters.minAmount = parseFloat(minAmount);
      if (maxAmount && typeof maxAmount === "string") filters.maxAmount = parseFloat(maxAmount);
      if (limit && typeof limit === "string") filters.limit = parseInt(limit);
      if (offset && typeof offset === "string") filters.offset = parseInt(offset);

      const expenses = await storage.getAllExpenses(filters);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching all expenses:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  // Update expense
  app.put("/api/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { description, amount, payerId, date, participants } = req.body;

      const expenseData: any = {};
      if (description !== undefined) expenseData.description = description;
      if (amount !== undefined) expenseData.amount = amount;
      if (payerId !== undefined) expenseData.payerId = payerId;
      if (date !== undefined) expenseData.date = new Date(date);

      const expense = await storage.updateExpense(id, expenseData, participants);
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  // Delete expense
  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteExpense(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Create user
  app.post("/api/users", async (req, res) => {
    try {
      const userValidation = z.object({
        name: z.string().min(1),
        initials: z.string().min(1).max(3),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      });

      const validatedData = userValidation.parse(req.body);
      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Update user
  app.put("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userValidation = z.object({
        name: z.string().min(1).optional(),
        initials: z.string().min(1).max(3).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      });

      const validatedData = userValidation.parse(req.body);
      const user = await storage.updateUser(id, validatedData);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Toggle user active status
  app.patch("/api/users/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.toggleUserActive(id);
      res.json(user);
    } catch (error) {
      console.error("Error toggling user status:", error);
      res.status(500).json({ error: "Failed to toggle user status" });
    }
  });

  // Get statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const { year, month } = req.query;
      
      const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
      const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;

      const [totalSpent, monthlyCount] = await Promise.all([
        storage.getTotalSpent(),
        storage.getMonthlyExpenseCount(currentYear, currentMonth),
      ]);

      res.json({
        totalSpent,
        monthlyExpenses: monthlyCount,
      });
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Initialize predefined users if none exist
  app.post("/api/initialize", async (req, res) => {
    try {
      const existingUsers = await storage.getUsers();
      
      if (existingUsers.length === 0) {
        const predefinedUsers = [
          { name: "Juan García", initials: "JG", color: "#3B82F6" },
          { name: "María López", initials: "ML", color: "#8B5CF6" },
          { name: "Carlos Ruiz", initials: "CR", color: "#10B981" },
          { name: "Ana Martínez", initials: "AM", color: "#EF4444" },
        ];

        for (const userData of predefinedUsers) {
          await storage.createUser(userData);
        }

        const newUsers = await storage.getUsers();
        res.json({ message: "Users initialized", users: newUsers });
      } else {
        res.json({ message: "Users already exist", users: existingUsers });
      }
    } catch (error) {
      console.error("Error initializing users:", error);
      res.status(500).json({ error: "Failed to initialize users" });
    }
  });

  // Get all payments
  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Create payment
  app.post("/api/payments", async (req, res) => {
    try {
      const paymentValidation = z.object({
        fromUserId: z.string(),
        toUserId: z.string(),
        amount: z.string(),
        description: z.string().optional(),
        paymentDate: z.string().optional(),
      });

      const validatedData = paymentValidation.parse(req.body);
      
      const payment = await storage.createPayment({
        fromUserId: validatedData.fromUserId,
        toUserId: validatedData.toUserId,
        amount: validatedData.amount,
        description: validatedData.description,
        paymentDate: validatedData.paymentDate ? new Date(validatedData.paymentDate) : undefined,
      });

      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // Delete payment
  app.delete("/api/payments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePayment(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment:", error);
      res.status(500).json({ error: "Failed to delete payment" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
