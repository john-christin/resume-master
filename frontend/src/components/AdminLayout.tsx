import {
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  LayoutDashboard,
  Layers,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { getUsers } from "../api/admin";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type NavItem = {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

const BASE_ITEMS: Omit<NavItem, "badge">[] = [
  { path: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { path: "/admin/pending",   label: "Pending",        icon: <Shield className="h-4 w-4" /> },
  { path: "/admin/users",     label: "Users",          icon: <Users className="h-4 w-4" /> },
  { path: "/admin/pricing",   label: "Pricing",        icon: <DollarSign className="h-4 w-4" /> },
  { path: "/admin/stacks",      label: "Tech Stacks",    icon: <Layers className="h-4 w-4" /> },
  { path: "/admin/doc-styles",  label: "Doc Styles",     icon: <FileText className="h-4 w-4" /> },
  { path: "/admin/kb",        label: "Knowledge Base", icon: <BookOpen className="h-4 w-4" /> },
  { path: "/admin/models",    label: "AI Models",      icon: <Bot className="h-4 w-4" /> },
  { path: "/admin/logs",      label: "System Logs",    icon: <ScrollText className="h-4 w-4" /> },
];

export default function AdminLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("admin-sidebar") === "1"
  );
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    localStorage.setItem("admin-sidebar", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    getUsers("pending")
      .then((r) => setPendingCount(r.data.length))
      .catch(() => {});
  }, [location.pathname]);

  const items: NavItem[] = BASE_ITEMS.map((item) => ({
    ...item,
    badge: item.path === "/admin/pending" ? pendingCount || undefined : undefined,
  }));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <aside
          className={cn(
            "relative flex flex-col border-r bg-muted/20 transition-[width] duration-200 ease-in-out shrink-0",
            collapsed ? "w-[57px]" : "w-[220px]"
          )}
        >
          {/* Header row */}
          <div
            className={cn(
              "flex h-14 items-center border-b shrink-0 px-3 gap-2",
              collapsed ? "justify-center" : "justify-between"
            )}
          >
            {!collapsed && (
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                Admin Panel
              </span>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 space-y-0.5 p-2 pt-3">
            {items.map((item) => {
              const isActive =
                item.path === "/admin/dashboard"
                  ? location.pathname === "/admin/dashboard"
                  : location.pathname === item.path ||
                    location.pathname.startsWith(item.path + "/");

              const link = (
                <Link
                  to={item.path}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    collapsed && "justify-center",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <Badge
                          variant={isActive ? "secondary" : "warning"}
                          className="h-4 min-w-4 px-1 text-[10px]"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                  {collapsed && item.badge != null && item.badge > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </Link>
              );

              return collapsed ? (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                    {item.badge != null && item.badge > 0 && ` (${item.badge})`}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.path}>{link}</div>
              );
            })}
          </nav>
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-6xl mx-auto p-6 sm:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
