import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { type Expense } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, ChevronRight, Calendar as CalendarIcon, TrendingUp, Edit, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import ExpenseEditModal from "@/components/expense-edit-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface MonthGroup {
  year: number;
  month: number;
  total: string;
  count: number;
  expenses: Expense[];
}

export default function History() {
  const [, setLocation] = useLocation();
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all expenses
  const { data: allExpenses = [], isLoading } = useQuery({
    queryKey: ["/api/expenses/all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/expenses/all");
      return response.json();
    },
  });

  // Group expenses by month
  const monthGroups = useMemo(() => {
    const groups = new Map<string, MonthGroup>();

    allExpenses.forEach((expense: Expense) => {
      const date = parseISO(expense.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          year: date.getFullYear(),
          month: date.getMonth(),
          total: "0",
          count: 0,
          expenses: [],
        });
      }

      const group = groups.get(key)!;
      group.expenses.push(expense);
      group.count++;
      group.total = (parseFloat(group.total) + parseFloat(expense.amount)).toFixed(2);
    });

    // Sort by date (most recent first)
    return Array.from(groups.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [allExpenses]);

  const toggleMonth = (year: number, month: number) => {
    const key = `${year}-${month}`;
    const newSet = new Set(expandedMonths);
    if (newSet.has(key)) {
      newSet.delete(key);
      setSelectedDay(null);
    } else {
      newSet.add(key);
    }
    setExpandedMonths(newSet);
  };

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await apiRequest("DELETE", `/api/expenses/${expenseId}`);
    },
    onSuccess: () => {
      toast({
        title: "Gasto eliminado",
        description: "El gasto se ha eliminado correctamente",
      });
      setDeletingExpenseId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el gasto",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </Button>
              <div className="h-6 w-px bg-border"></div>
              <h1 className="text-xl font-bold text-foreground flex items-center">
                <CalendarIcon className="w-5 h-5 mr-2" />
                Historial de Gastos
              </h1>
            </div>
            <Badge variant="secondary" className="text-sm">
              {allExpenses.length} gastos registrados
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {monthGroups.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CalendarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay gastos registrados</h3>
              <p className="text-muted-foreground mb-4">
                Comienza a registrar tus gastos desde el dashboard
              </p>
              <Button onClick={() => setLocation("/")}>
                Ir al Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {monthGroups.map((group) => {
              const key = `${group.year}-${group.month}`;
              const isExpanded = expandedMonths.has(key);
              const monthDate = new Date(group.year, group.month, 1);

              return (
                <Card key={key} className="shadow-md">
                  <CardContent className="p-0">
                    {/* Month Header */}
                    <button
                      onClick={() => toggleMonth(group.year, group.month)}
                      className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-primary" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div className="text-left">
                          <h2 className="text-xl font-bold text-foreground">
                            {format(monthDate, "MMMM yyyy", { locale: es })}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {group.count} {group.count === 1 ? "gasto" : "gastos"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-foreground">
                            ${parseFloat(group.total).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Total del mes</p>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-border p-6 space-y-6">
                        {/* Calendar */}
                        <MonthCalendar
                          year={group.year}
                          month={group.month}
                          expenses={group.expenses}
                          selectedDay={selectedDay}
                          onDayClick={setSelectedDay}
                        />

                        {/* Day Expenses */}
                        {selectedDay && isSameMonth(selectedDay, monthDate) && (
                          <DayExpenses
                            date={selectedDay}
                            expenses={group.expenses.filter(e =>
                              isSameDay(parseISO(e.date), selectedDay)
                            )}
                            onEdit={setEditingExpense}
                            onDelete={setDeletingExpenseId}
                          />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit Modal */}
        <ExpenseEditModal
          expense={editingExpense}
          open={!!editingExpense}
          onOpenChange={(open) => !open && setEditingExpense(null)}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingExpenseId} onOpenChange={(open) => !open && setDeletingExpenseId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El gasto será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingExpenseId && deleteExpenseMutation.mutate(deletingExpenseId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

// Month Calendar Component
function MonthCalendar({
  year,
  month,
  expenses,
  selectedDay,
  onDayClick,
}: {
  year: number;
  month: number;
  expenses: Expense[];
  selectedDay: Date | null;
  onDayClick: (date: Date) => void;
}) {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get days with expenses
  const daysWithExpenses = new Set(
    expenses.map(e => format(parseISO(e.date), "yyyy-MM-dd"))
  );

  // Fill calendar grid (start on Monday)
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(days);

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">
        Calendario del Mes
      </h3>
      <div className="grid grid-cols-7 gap-2">
        {/* Week day headers */}
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dayKey = format(day, "yyyy-MM-dd");
          const hasExpenses = daysWithExpenses.has(dayKey);
          const isSelected = selectedDay && isSameDay(day, selectedDay);

          return (
            <button
              key={dayKey}
              onClick={() => hasExpenses && onDayClick(day)}
              disabled={!hasExpenses}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center text-sm
                transition-all relative
                ${hasExpenses
                  ? 'hover:bg-primary/10 cursor-pointer border-2 border-primary/20'
                  : 'text-muted-foreground cursor-not-allowed'
                }
                ${isSelected
                  ? 'bg-primary text-primary-foreground hover:bg-primary'
                  : 'bg-muted'
                }
              `}
            >
              <span className="font-medium">{format(day, 'd')}</span>
              {hasExpenses && (
                <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Day Expenses Component
function DayExpenses({
  date,
  expenses,
  onEdit,
  onDelete,
}: {
  date: Date;
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const dayTotal = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {format(date, "d 'de' MMMM", { locale: es })}
        </h3>
        <Badge variant="secondary">
          Total: ${dayTotal.toFixed(2)}
        </Badge>
      </div>

      <div className="space-y-2">
        {expenses.map((expense) => (
          <Card key={expense.id} className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    {expense.description}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Pagó: <span className="font-medium">{expense.payer.name}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {expense.participants.map((p) => (
                      <Badge key={p.id} variant="outline" className="text-xs">
                        {p.user.name}: ${parseFloat(p.amount).toFixed(2)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <p className="text-lg font-bold text-foreground">
                    ${parseFloat(expense.amount).toFixed(2)}
                  </p>
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(expense)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(expense.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
