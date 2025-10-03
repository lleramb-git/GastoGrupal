import { useState } from "react";
import { useLocation } from "wouter";
import Calendar from "@/components/calendar";
import ExpenseForm from "@/components/expense-form";
import DailyExpenses from "@/components/daily-expenses";
import DebtSummary from "@/components/debt-summary";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Receipt, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-primary-foreground w-10 h-10 rounded-lg flex items-center justify-center">
                <Receipt className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Gastos Compartidos</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="hidden sm:flex items-center space-x-2"
                data-testid="button-history"
                onClick={() => setLocation("/historial")}
              >
                <Clock className="w-4 h-4" />
                <span>Historial</span>
              </Button>
              <Button 
                size="sm" 
                className="flex items-center space-x-2 shadow-md"
                data-testid="button-new-expense"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Gasto</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Calendar and Forms Section */}
          <div className="lg:col-span-2 space-y-6">
            <Calendar 
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
            
            <ExpenseForm selectedDate={selectedDate} />
            
            <DailyExpenses selectedDate={selectedDate} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <DebtSummary />
          </div>
          
        </div>

        {/* Quick Stats Banner */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fecha Seleccionada</p>
                <p className="text-lg font-bold text-foreground" data-testid="text-selected-date">
                  {format(selectedDate, "d 'de' MMMM", { locale: es })}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Receipt className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sistema</p>
                <p className="text-lg font-bold text-secondary">Activo</p>
              </div>
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-secondary rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Base de Datos</p>
                <p className="text-lg font-bold text-accent">Supabase</p>
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-accent rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuarios</p>
                <p className="text-lg font-bold text-foreground">4</p>
              </div>
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
