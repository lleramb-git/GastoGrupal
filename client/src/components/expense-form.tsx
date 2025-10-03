import { useState, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { PlusCircle, Save, Equal, Percent, DollarSign, AlertCircle, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
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

  const totalAmount = parseFloat(form.watch("amount") || "0");

  // Calculate validation status
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

  const createExpenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      toast({
        title: "💸 Ahí va!",
        description: "Gasto registrado, menudo gasto...",
      });
      form.reset();
      setSelectedParticipants(new Set());
      setPercentages({});
      setExactAmounts({});
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "💩 Error de mierda",
        description: error.message || "No se pudo guardar el gasto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (selectedParticipants.size === 0) {
      toast({
        title: "⚠️ Ey, espabila",
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
          title: "🤔 Las mates no cuadran",
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
          title: "🤔 Las mates no cuadran",
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
      // Remove from percentages/exact amounts
      const newPercentages = { ...percentages };
      delete newPercentages[userId];
      setPercentages(newPercentages);
      
      const newExactAmounts = { ...exactAmounts };
      delete newExactAmounts[userId];
      setExactAmounts(newExactAmounts);
    } else {
      newSet.add(userId);
      // Initialize with default values
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

  // Update percentages/amounts when changing split type
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
            💸 ¿Quién ha soltado la pasta esta vez?
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

            {/* Participants Selection */}
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

              {/* Combobox for selecting participants */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      selectedParticipants.size === 0 && "text-muted-foreground"
                    )}
                  >
                    {selectedParticipants.size === 0
                      ? "Seleccionar participantes..."
                      : `${selectedParticipants.size} participante${selectedParticipants.size > 1 ? "s" : ""} seleccionado${selectedParticipants.size > 1 ? "s" : ""}`
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar usuario..." />
                    <CommandEmpty>No se encontraron usuarios.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {users.filter(u => u.active).map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => toggleParticipant(user.id)}
                          className="flex items-center space-x-2"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedParticipants.has(user.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                            style={{ backgroundColor: user.color }}
                          >
                            {user.initials}
                          </div>
                          <span>{user.name}</span>
                          {selectedParticipants.has(user.id) && splitType === "equal" && totalAmount > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              ${(totalAmount / selectedParticipants.size).toFixed(2)}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Selected participants chips */}
              {selectedParticipants.size > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {Array.from(selectedParticipants).map(userId => {
                    const user = users.find(u => u.id === userId);
                    if (!user) return null;
                    return (
                      <div key={userId} className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-3 py-1 rounded-full">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-white"
                          style={{ backgroundColor: user.color }}
                        >
                          {user.initials}
                        </div>
                        <span className="text-sm font-medium">{user.name}</span>
                        <button
                          type="button"
                          onClick={() => toggleParticipant(userId)}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Individual participant inputs */}
              <div className="space-y-2 mt-3">
                {Array.from(selectedParticipants).map(userId => {
                  const user = users.find(u => u.id === userId);
                  if (!user) return null;
                  
                  return (
                    <div key={userId} className="space-y-2">
                      {/* Percentage Input */}
                      {splitType === "percentage" && (
                        <div className="flex items-center space-x-2">
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

                      {/* Exact Amount Input */}
                      {splitType === "exact" && (
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
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
                  );
                })}
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
