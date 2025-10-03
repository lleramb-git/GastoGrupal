import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDebts, getStats, getUsers } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartPie, Scale, Users, Calculator, UserPlus, CheckCircle, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import UserManagement from "./user-management";
import PaymentHistoryModal from "./payment-history-modal";

export default function DebtSummary() {
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: debts = [], isLoading: debtsLoading } = useQuery({
    queryKey: ["/api/debts"],
    queryFn: getDebts,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: () => getStats(),
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: getUsers,
  });

  const avgPerPerson = stats ? (parseFloat(stats.totalSpent) / Math.max(users.length, 1)).toFixed(2) : "0.00";

  const markAsPaidMutation = useMutation({
    mutationFn: async (debt: typeof debts[0]) => {
      const response = await apiRequest("POST", "/api/payments", {
        fromUserId: debt.debtor.id,
        toUserId: debt.creditor.id,
        amount: debt.amount,
        description: `Pago de deuda: ${debt.debtor.name} a ${debt.creditor.name}`,
      });
      return response.json();
    },
    onSuccess: async () => {
      // Refrescar inmediatamente las deudas
      await queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      await queryClient.refetchQueries({ queryKey: ["/api/debts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      toast({
        title: "🎉 Toma ya!",
        description: "Ya no eres un moroso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "💩 Uy, la hemos cagado",
        description: error.message || "No se pudo registrar el pago",
        variant: "destructive",
      });
    },
  });

  const handleMarkAsPaid = (debt: typeof debts[0]) => {
    markAsPaidMutation.mutate(debt);
  };

  return (
    <div className="space-y-6">
      
      {/* Summary Card */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center">
            <ChartPie className="w-5 h-5 text-primary mr-2" />
            📊 El Contador de Pobres
          </h3>

          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Gastado</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-foreground" data-testid="text-total-spent">
                  ${parseFloat(stats?.totalSpent || "0").toFixed(2)}
                </p>
              )}
            </div>

            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Gastos del Mes</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-foreground" data-testid="text-monthly-expenses">
                  {stats?.monthlyExpenses || 0}
                </p>
              )}
            </div>

            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Promedio por Persona</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold text-foreground" data-testid="text-avg-per-person">
                  ${avgPerPerson}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debt Balance Card */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center">
            <Scale className="w-5 h-5 text-accent mr-2" />
            💀 ¿Quién debe pasta?
          </h3>

          {debtsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : debts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-lg font-bold text-green-600 mb-2">
                🎉 ¡Enhorabuena!
              </p>
              <p className="text-muted-foreground" data-testid="text-no-debts">
                Todos estáis igual de pelados 🦗
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {debts.map((debt, index) => (
                <div 
                  key={index} 
                  className="bg-background border border-border rounded-lg p-4"
                  data-testid={`debt-${index}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white"
                        style={{ backgroundColor: debt.debtor.color }}
                      >
                        {debt.debtor.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {debt.debtor.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          debe a {debt.creditor.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pendiente por pagar:</span>
                      <span className="text-lg font-bold text-destructive">
                        ${parseFloat(debt.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => handleMarkAsPaid(debt)}
                    disabled={markAsPaidMutation.isPending}
                  >
                    {markAsPaidMutation.isPending ? (
                      <>
                        <div className="w-3 h-3 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3 mr-2" />
                        <span>Dale, ya te pagaron 💰</span>
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button 
            variant="outline"
            className="w-full mt-4"
            onClick={() => setIsPaymentHistoryOpen(true)}
          >
            <History className="w-4 h-4 mr-2" />
            📜 Ver Historial de Pagos
          </Button>

          <Button 
            className="w-full mt-4 bg-accent hover:bg-accent/90" 
            variant="default"
            data-testid="button-simplify-debts"
          >
            <Calculator className="w-4 h-4 mr-2" />
            🔥 Ajustar Cuentas
          </Button>
        </CardContent>
      </Card>

      {/* Active Users Card */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center">
            <Users className="w-5 h-5 text-secondary mr-2" />
            👥 La Peña
          </h3>

          {usersLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div 
                  key={user.id}
                  className="user-badge flex items-center justify-between p-3 bg-muted rounded-lg transition-all duration-200 hover:scale-105"
                  data-testid={`user-${user.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Usuario activo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-secondary rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button 
            variant="outline" 
            className="w-full mt-4"
            data-testid="button-manage-users"
            onClick={() => setIsUserManagementOpen(true)}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            ⚙️ Gestionar la Peña
          </Button>
        </CardContent>
      </Card>

      {/* User Management Modal */}
      <UserManagement
        open={isUserManagementOpen}
        onOpenChange={setIsUserManagementOpen}
      />

      {/* Payment History Modal */}
      <PaymentHistoryModal
        open={isPaymentHistoryOpen}
        onOpenChange={setIsPaymentHistoryOpen}
      />
    </div>
  );
}
