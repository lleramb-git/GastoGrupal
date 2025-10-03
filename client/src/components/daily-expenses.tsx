import { useQuery } from "@tanstack/react-query";
import { getExpensesByDate } from "@/lib/supabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { UserCircle } from "lucide-react";

interface DailyExpensesProps {
  selectedDate: Date;
}

export default function DailyExpenses({ selectedDate }: DailyExpensesProps) {
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["/api/expenses", format(selectedDate, "yyyy-MM-dd")],
    queryFn: () => getExpensesByDate(format(selectedDate, "yyyy-MM-dd")),
  });

  const dailyTotal = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-6 bg-muted rounded w-1/2"></div>
              <div className="h-6 bg-muted rounded w-1/4"></div>
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">
            Gastos del {format(selectedDate, "d 'de' MMMM", { locale: es })}
          </h3>
          <span className="text-sm text-muted-foreground">
            Total: <span className="font-bold text-foreground" data-testid="text-daily-total">
              ${dailyTotal.toFixed(2)}
            </span>
          </span>
        </div>

        {expenses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground" data-testid="text-no-expenses">
              No hay gastos registrados para esta fecha
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <div 
                key={expense.id} 
                className="expense-card bg-background border border-border rounded-lg p-4 transition-all duration-200 hover:shadow-lg"
                data-testid={`expense-card-${expense.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">
                      {expense.description}
                    </h4>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <UserCircle className="w-4 h-4 mr-1" />
                      Pagado por <span className="font-medium ml-1">{expense.payer.name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      ${parseFloat(expense.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.date), "HH:mm")}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-sm font-medium text-muted-foreground mb-2">División:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {expense.participants.map((participant) => (
                      <div 
                        key={participant.id}
                        className="flex items-center justify-between text-sm"
                        data-testid={`participant-${participant.userId}`}
                      >
                        <span className="text-foreground">{participant.user.name}</span>
                        <span className={`font-medium ${
                          participant.userId === expense.payerId 
                            ? "text-secondary" 
                            : "text-destructive"
                        }`}>
                          ${parseFloat(participant.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
