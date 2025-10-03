import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { getUsers, type Expense } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Equal, Percent, DollarSign, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ExpenseEditModalProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  description: z.string().min(1, "La descripción es requerida"),
  amount: z.string().min(1, "El monto es requerido").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Debe ser un número positivo"
  ),
  payerId: z.string().min(1, "Selecciona quién pagó"),
});

export default function ExpenseEditModal({ expense, open, onOpenChange }: ExpenseEditModalProps) {
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "exact">("equal");
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: getUsers,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: "",
      payerId: "",
    },
  });

  const totalAmount = parseFloat(form.watch("amount") || "0");

  // Initialize form with expense data
  useEffect(() => {
    if (expense) {
      form.setValue("description", expense.description);
      form.setValue("amount", expense.amount);
      form.setValue("payerId", expense.payerId);

      const participantIds = new Set(expense.participants.map(p => p.userId));
      setSelectedParticipants(participantIds);

      // Detect split type and set values
      const amounts = expense.participants.map(p => parseFloat(p.amount));
      const total = parseFloat(expense.amount);
      const equalAmount = total / expense.participants.length;
      
      // Check if it's equal split
      const isEqual = amounts.every(amt => Math.abs(amt - equalAmount) < 0.01);
      
      if (isEqual) {
        setSplitType("equal");
      } else {
        // Default to exact amounts
        setSplitType("exact");
        const newExactAmounts: Record<string, string> = {};
        expense.participants.forEach(p => {
          newExactAmounts[p.userId] = p.amount;
        });
        setExactAmounts(newExactAmounts);
      }
    }
  }, [expense, form]);

  const getValidationStatus = () => {
    if (splitType === "percentage") {
      const total = Array.from(selectedParticipants).reduce((sum, userId) => {
        return sum + (parseFloat(percentages[userId] || "0"));
      }, 0);
      return {
        isValid: Math.abs(total - 100) < 0.01,
        message: `Total: ${total.toFixed(1)}%`,
        color: Math.abs(total - 100) < 0.01 ? "text-green-600" : "text-destructive"
      };
    } else if (splitType === "exact") {
      const total = Array.from(selectedParticipants).reduce((sum, userId) => {
        return sum + (parseFloat(exactAmounts[userId] || "0"));
      }, 0);
      const diff = totalAmount - total;
      return {
        isValid: Math.abs(diff) < 0.01,
        message: `Total: $${total.toFixed(2)} / $${totalAmount.toFixed(2)}`,
        color: Math.abs(diff) < 0.01 ? "text-green-600" : "text-destructive"
      };
    }
    return { isValid: true, message: "", color: "" };
  };

  const validationStatus = getValidationStatus();

  const updateExpenseMutation = useMutation({
    mutationFn: async (data: { description: string; amount: string; payerId: string; participants: { userId: string; amount: string }[] }) => {
      const response = await apiRequest("PUT", `/api/expenses/${expense?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Gasto actualizado",
        description: "El gasto se ha actualizado correctamente",
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el gasto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (selectedParticipants.size === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un participante",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(values.amount);
    let participants: { userId: string; amount: string }[] = [];

    if (splitType === "equal") {
      const participantCount = selectedParticipants.size;
      const amountPerPerson = (amount / participantCount).toFixed(2);
      participants = Array.from(selectedParticipants).map(userId => ({
        userId,
        amount: amountPerPerson,
      }));
    } else if (splitType === "percentage") {
      if (!validationStatus.isValid) {
        toast({
          title: "Error",
          description: "Los porcentajes deben sumar 100%",
          variant: "destructive",
        });
        return;
      }
      participants = Array.from(selectedParticipants).map(userId => ({
        userId,
        amount: ((amount * parseFloat(percentages[userId] || "0")) / 100).toFixed(2),
      }));
    } else if (splitType === "exact") {
      if (!validationStatus.isValid) {
        toast({
          title: "Error",
          description: "La suma de montos debe ser igual al total",
          variant: "destructive",
        });
        return;
      }
      participants = Array.from(selectedParticipants).map(userId => ({
        userId,
        amount: parseFloat(exactAmounts[userId] || "0").toFixed(2),
      }));
    }

    updateExpenseMutation.mutate({
      description: values.description,
      amount: values.amount,
      payerId: values.payerId,
      participants,
    });
  };

  const toggleParticipant = (userId: string) => {
    const newSet = new Set(selectedParticipants);
    if (newSet.has(userId)) {
      newSet.delete(userId);
      const newPercentages = { ...percentages };
      delete newPercentages[userId];
      setPercentages(newPercentages);
      
      const newExactAmounts = { ...exactAmounts };
      delete newExactAmounts[userId];
      setExactAmounts(newExactAmounts);
    } else {
      newSet.add(userId);
      if (splitType === "percentage") {
        const equalPercent = (100 / (newSet.size)).toFixed(1);
        const newPercentages: Record<string, string> = {};
        newSet.forEach(id => {
          newPercentages[id] = percentages[id] || equalPercent;
        });
        setPercentages(newPercentages);
      } else if (splitType === "exact") {
        const equalAmount = (totalAmount / (newSet.size)).toFixed(2);
        const newExactAmounts: Record<string, string> = {};
        newSet.forEach(id => {
          newExactAmounts[id] = exactAmounts[id] || equalAmount;
        });
        setExactAmounts(newExactAmounts);
      }
    }
    setSelectedParticipants(newSet);
  };

  useEffect(() => {
    if (selectedParticipants.size === 0) return;
    
    if (splitType === "percentage") {
      const equalPercent = (100 / selectedParticipants.size).toFixed(1);
      const newPercentages: Record<string, string> = {};
      selectedParticipants.forEach(userId => {
        newPercentages[userId] = percentages[userId] || equalPercent;
      });
      setPercentages(newPercentages);
    } else if (splitType === "exact" && totalAmount > 0) {
      const equalAmount = (totalAmount / selectedParticipants.size).toFixed(2);
      const newExactAmounts: Record<string, string> = {};
      selectedParticipants.forEach(userId => {
        newExactAmounts[userId] = exactAmounts[userId] || equalAmount;
      });
      setExactAmounts(newExactAmounts);
    }
  }, [splitType]);

  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Gasto</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto del Gasto</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      placeholder="Ej: Cena en restaurante"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Quién pagó?</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar usuario..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.filter(u => u.active).map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">
                Tipo de División
              </Label>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setSplitType("equal")}
                  className={`flex-1 flex items-center justify-center p-3 rounded-lg cursor-pointer transition-colors ${
                    splitType === "equal"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Equal className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Equitativo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType("percentage")}
                  className={`flex-1 flex items-center justify-center p-3 rounded-lg cursor-pointer transition-colors ${
                    splitType === "percentage"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Percent className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Porcentaje</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType("exact")}
                  className={`flex-1 flex items-center justify-center p-3 rounded-lg cursor-pointer transition-colors ${
                    splitType === "exact"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Exacto</span>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium text-foreground">
                  Participantes
                </Label>
                {(splitType === "percentage" || splitType === "exact") && selectedParticipants.size > 0 && (
                  <span className={`text-sm font-medium ${validationStatus.color}`}>
                    {validationStatus.message}
                  </span>
                )}
              </div>
              
              {!validationStatus.isValid && selectedParticipants.size > 0 && (splitType === "percentage" || splitType === "exact") && (
                <Alert className="mb-3" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {splitType === "percentage" 
                      ? "Los porcentajes deben sumar exactamente 100%" 
                      : "La suma de montos debe ser igual al monto total"}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                {users.filter(u => u.active).map((user) => (
                  <div key={user.id} className="space-y-2">
                    <label className="flex items-center p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors">
                      <Checkbox
                        checked={selectedParticipants.has(user.id)}
                        onCheckedChange={() => toggleParticipant(user.id)}
                      />
                      <div className="ml-3 flex items-center flex-1">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
                          style={{ backgroundColor: user.color }}
                        >
                          {user.initials}
                        </div>
                        <span className="ml-3 text-sm font-medium text-foreground">
                          {user.name}
                        </span>
                      </div>
                      
                      {selectedParticipants.has(user.id) && splitType === "equal" && totalAmount > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ${(totalAmount / selectedParticipants.size).toFixed(2)}
                        </span>
                      )}
                    </label>

                    {selectedParticipants.has(user.id) && splitType === "percentage" && (
                      <div className="ml-11 flex items-center space-x-2">
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={percentages[user.id] || ""}
                            onChange={(e) => setPercentages({
                              ...percentages,
                              [user.id]: e.target.value
                            })}
                            placeholder="0.0"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                        {totalAmount > 0 && percentages[user.id] && (
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            = ${((totalAmount * parseFloat(percentages[user.id])) / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}

                    {selectedParticipants.has(user.id) && splitType === "exact" && (
                      <div className="ml-11">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={exactAmounts[user.id] || ""}
                            onChange={(e) => setExactAmounts({
                              ...exactAmounts,
                              [user.id]: e.target.value
                            })}
                            placeholder="0.00"
                            className="pl-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={updateExpenseMutation.isPending}
              >
                {updateExpenseMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    <span>Guardando...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Save className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </div>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
