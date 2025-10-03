import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { getUsers, createExpense, initializeApp } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Save, Equal, Percent, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

interface ExpenseFormProps {
  selectedDate: Date;
}

const formSchema = z.object({
  description: z.string().min(1, "La descripción es requerida"),
  amount: z.string().min(1, "El monto es requerido").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Debe ser un número positivo"
  ),
  payerId: z.string().min(1, "Selecciona quién pagó"),
});

export default function ExpenseForm({ selectedDate }: ExpenseFormProps) {
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "exact">("equal");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize app and get users
  useQuery({
    queryKey: ["/api/initialize"],
    queryFn: initializeApp,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
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

  const createExpenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      toast({
        title: "Gasto guardado",
        description: "El gasto se ha registrado correctamente",
      });
      form.reset();
      setSelectedParticipants(new Set());
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el gasto",
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
    const participantCount = selectedParticipants.size;
    const amountPerPerson = (amount / participantCount).toFixed(2);

    const participants = Array.from(selectedParticipants).map(userId => ({
      userId,
      amount: amountPerPerson,
    }));

    createExpenseMutation.mutate({
      description: values.description,
      amount: values.amount,
      payerId: values.payerId,
      date: format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
      participants,
    });
  };

  const toggleParticipant = (userId: string) => {
    const newSet = new Set(selectedParticipants);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedParticipants(newSet);
  };

  if (usersLoading) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center">
          <PlusCircle className="w-5 h-5 text-primary mr-2" />
          Registrar Nuevo Gasto
        </h3>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Amount Input */}
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
                        data-testid="input-amount"
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Description */}
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
                      data-testid="input-description"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Payer Selection */}
            <FormField
              control={form.control}
              name="payerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Quién pagó?</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payer">
                        <SelectValue placeholder="Seleccionar usuario..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {/* Participants Selection */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-3 block">
                Participantes
              </Label>
              <div className="space-y-2">
                {users.map((user) => (
                  <label 
                    key={user.id}
                    className="flex items-center p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                  >
                    <Checkbox
                      checked={selectedParticipants.has(user.id)}
                      onCheckedChange={() => toggleParticipant(user.id)}
                      data-testid={`checkbox-participant-${user.id}`}
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
                  </label>
                ))}
              </div>
            </div>

            {/* Split Type */}
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
                  data-testid="button-split-equal"
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
                  data-testid="button-split-percentage"
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
                  data-testid="button-split-exact"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Exacto</span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full shadow-md"
              disabled={createExpenseMutation.isPending}
              data-testid="button-save-expense"
            >
              {createExpenseMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Guardar Gasto</span>
                </div>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
