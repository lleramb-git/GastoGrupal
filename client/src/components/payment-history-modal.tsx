import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, History, Calendar, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
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
import { useState } from "react";

interface Payment {
  id: string;
  fromUser: {
    id: string;
    name: string;
    initials: string;
    color: string;
  };
  toUser: {
    id: string;
    name: string;
    initials: string;
    color: string;
  };
  amount: string;
  description: string | null;
  payment_date: string;
}

interface PaymentHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PaymentHistoryModal({ open, onOpenChange }: PaymentHistoryModalProps) {
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments");
      return response.json();
    },
    enabled: open,
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await apiRequest("DELETE", `/api/payments/${paymentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Pago eliminado",
        description: "El pago se ha eliminado correctamente",
      });
      setDeletingPaymentId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el pago",
        variant: "destructive",
      });
    },
  });

  const totalPayments = payments.reduce((sum: number, p: Payment) => sum + parseFloat(p.amount), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl">
              <History className="w-5 h-5 mr-2 text-primary" />
              Historial de Pagos
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay pagos registrados</h3>
              <p className="text-muted-foreground">
                Los pagos registrados aparecerán aquí
              </p>
            </div>
          ) : (
            <>
              {/* Summary Card */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pagado</p>
                      <p className="text-2xl font-bold text-foreground">
                        ${totalPayments.toFixed(2)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {payments.length} {payments.length === 1 ? "pago" : "pagos"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Payments List */}
              <div className="space-y-3 mt-4">
                {payments.map((payment: Payment) => (
                  <Card key={payment.id} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* From -> To */}
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                                style={{ backgroundColor: payment.fromUser.color }}
                              >
                                {payment.fromUser.initials}
                              </div>
                              <span className="font-medium text-foreground">
                                {payment.fromUser.name}
                              </span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                                style={{ backgroundColor: payment.toUser.color }}
                              >
                                {payment.toUser.initials}
                              </div>
                              <span className="font-medium text-foreground">
                                {payment.toUser.name}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          {payment.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {payment.description}
                            </p>
                          )}

                          {/* Date */}
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3 mr-1" />
                            {payment.payment_date ? 
                              format(parseISO(payment.payment_date), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
                              : 'Fecha no disponible'
                            }
                          </div>
                        </div>

                        {/* Amount and Actions */}
                        <div className="flex flex-col items-end space-y-2">
                          <p className="text-xl font-bold text-green-600">
                            ${parseFloat(payment.amount).toFixed(2)}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingPaymentId(payment.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPaymentId} onOpenChange={(open) => !open && setDeletingPaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pago será eliminado y las deudas se recalcularán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPaymentId && deletePaymentMutation.mutate(deletingPaymentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
