import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:mm" local datetime string
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseLocal(s: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  return {
    year: parseInt(m[1]),
    month: parseInt(m[2]) - 1,
    day: parseInt(m[3]),
    hour: parseInt(m[4]),
    minute: parseInt(m[5]),
  };
}

function formatDisplay(s: string): string {
  const p = parseLocal(s);
  if (!p) return "";
  const d = new Date(p.year, p.month, p.day, p.hour, p.minute);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function DateTimePicker({ value, onChange, placeholder = "Pick date & time", className }: DateTimePickerProps) {
  const parsed = useMemo(() => parseLocal(value), [value]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [open, setOpen] = useState(false);

  const hour = parsed?.hour ?? 9;
  const minute = parsed?.minute ?? 0;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const selectDay = (day: number) => {
    const h = parsed?.hour ?? 9;
    const mi = parsed?.minute ?? 0;
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}T${pad(h)}:${pad(mi)}`);
  };

  const setTime = (h: number, mi: number) => {
    if (!parsed) {
      onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(today.getDate())}T${pad(h)}:${pad(mi)}`);
    } else {
      onChange(`${parsed.year}-${pad(parsed.month + 1)}-${pad(parsed.day)}T${pad(h)}:${pad(mi)}`);
    }
  };

  const isSelected = (day: number) =>
    parsed?.year === viewYear && parsed?.month === viewMonth && parsed?.day === day;

  const isToday = (day: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            {value ? formatDisplay(value) : placeholder}
          </span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              onPointerDown={(e) => { e.stopPropagation(); onChange(""); }}
              className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto" align="start">
        <div className="p-3 space-y-3">
          {/* Month navigation */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth} type="button">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth} type="button">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-0.5">
            {DAYS.map((d) => (
              <div key={d} className="h-7 w-7 flex items-center justify-center text-[11px] font-medium text-muted-foreground">
                {d}
              </div>
            ))}

            {/* Day cells */}
            {cells.map((day, i) =>
              day === null ? (
                <div key={`empty-${i}`} className="h-7 w-7" />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "h-7 w-7 rounded-md text-xs font-medium flex items-center justify-center transition-colors",
                    isSelected(day)
                      ? "bg-primary text-primary-foreground"
                      : isToday(day)
                        ? "bg-accent text-accent-foreground font-semibold"
                        : "hover:bg-accent hover:text-accent-foreground text-foreground"
                  )}
                >
                  {day}
                </button>
              )
            )}
          </div>

          {/* Time picker */}
          <div className="border-t pt-3">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1">
                <select
                  value={pad(hour)}
                  onChange={(e) => setTime(parseInt(e.target.value), minute)}
                  className="h-7 rounded-md border border-input bg-background px-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={pad(i)}>{pad(i)}</option>
                  ))}
                </select>
                <span className="text-sm font-bold text-muted-foreground">:</span>
                <select
                  value={pad(minute)}
                  onChange={(e) => setTime(hour, parseInt(e.target.value))}
                  className="h-7 rounded-md border border-input bg-background px-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={pad(m)}>{pad(m)}</option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs ml-auto"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
