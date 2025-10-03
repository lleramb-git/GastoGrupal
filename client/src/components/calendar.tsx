import { useQuery } from "@tanstack/react-query";
import { getExpensesByDate } from "@/lib/supabase";
import { format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay,
  isToday,
  addMonths,
  subMonths 
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export default function Calendar({ selectedDate, onDateSelect }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  // Get all days in the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the starting day of the week for the month
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // Generate calendar grid (42 days to fill 6 weeks)
  const calendarDays = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    calendarDays.push(day);
  }

  // Query for expenses in the current month to show indicators
  const { data: monthlyExpenses = [] } = useQuery({
    queryKey: ["/api/expenses/monthly", format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const promises = days.map(day => 
        getExpensesByDate(format(day, "yyyy-MM-dd"))
      );
      const results = await Promise.all(promises);
      return results.flat();
    }
  });

  const hasExpenses = (date: Date) => {
    return monthlyExpenses.some(expense => 
      isSameDay(new Date(expense.date), date)
    );
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  return (
    <Card className="shadow-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </h2>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={goToPreviousMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={goToNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day, index) => (
            <button
              key={index}
              onClick={() => onDateSelect(day)}
              className={cn(
                "calendar-day aspect-square rounded-lg p-2 flex flex-col items-center justify-center relative transition-all duration-200 hover:transform hover:-translate-y-1 hover:shadow-md",
                {
                  "bg-primary text-primary-foreground shadow-lg": isSameDay(day, selectedDate),
                  "bg-muted text-foreground": !isSameDay(day, selectedDate) && isCurrentMonth(day),
                  "text-muted-foreground": !isCurrentMonth(day),
                  "ring-2 ring-secondary": isToday(day) && !isSameDay(day, selectedDate),
                }
              )}
              data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
            >
              <span className="text-sm font-medium">
                {format(day, "d")}
              </span>
              {hasExpenses(day) && (
                <div className={cn(
                  "absolute bottom-1 w-1 h-1 rounded-full",
                  isSameDay(day, selectedDate) 
                    ? "bg-primary-foreground" 
                    : "bg-secondary"
                )} />
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-secondary rounded-full" />
            <span className="text-muted-foreground">Con gastos</span>
          </div>
          <div className="text-muted-foreground">
            <span data-testid="text-selected-date-full">
              {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
