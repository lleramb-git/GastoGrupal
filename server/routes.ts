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

  const httpServer = createServer(app);
  return httpServer;
}
