import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: { value: string; up?: boolean };
  className?: string;
};

export default function StatCard({ label, value, sub, icon, iconBg, iconColor, trend, className }: Props) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardContent className="pt-5 pb-4">
        <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4", iconBg ?? "bg-primary/10")}>
          <span className={iconColor ?? "text-primary"}>{icon}</span>
        </div>
        <p className="text-2xl font-semibold tracking-tight leading-none">{value}</p>
        <p className="text-sm text-muted-foreground mt-1.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
        {trend && (
          <p className={cn("text-xs mt-1.5 font-medium", trend.up ? "text-emerald-600" : "text-rose-500")}>
            {trend.up ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
