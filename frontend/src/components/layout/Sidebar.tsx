import {
  Ban,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  History,
  LayoutDashboard,
  Phone,
  ScrollText,
  Search,
  Shield,
  Users,
  Wand2,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

const BIDDER_NAV: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { path: "/profiles", label: "Profiles", icon: <FileText className="h-4 w-4" /> },
  { path: "/generate", label: "Generate", icon: <Wand2 className="h-4 w-4" /> },
  { path: "/history", label: "History", icon: <History className="h-4 w-4" /> },
  { path: "/calls", label: "Calls", icon: <Phone className="h-4 w-4" /> },
];

const CALLER_NAV: NavItem[] = [
  { path: "/history", label: "Search", icon: <Search className="h-4 w-4" /> },
  { path: "/calls", label: "Calls", icon: <Phone className="h-4 w-4" /> },
];

const ADMIN_MAIN_NAV: NavItem[] = [
  { path: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { path: "/profiles", label: "Profiles", icon: <FileText className="h-4 w-4" /> },
  { path: "/generate", label: "Generate", icon: <Wand2 className="h-4 w-4" /> },
  { path: "/history", label: "History", icon: <History className="h-4 w-4" /> },
  { path: "/calls", label: "Calls", icon: <Phone className="h-4 w-4" /> },
];

const ADMIN_CONFIG_NAV: Omit<NavItem, "badge">[] = [
  { path: "/admin/pending", label: "Pending", icon: <Shield className="h-4 w-4" /> },
  { path: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { path: "/admin/pricing", label: "Pricing", icon: <DollarSign className="h-4 w-4" /> },
  { path: "/admin/doc-styles", label: "Doc Styles", icon: <FileText className="h-4 w-4" /> },
  { path: "/admin/kb", label: "Knowledge Base", icon: <BookOpen className="h-4 w-4" /> },
  { path: "/admin/models", label: "AI Models", icon: <Bot className="h-4 w-4" /> },
  { path: "/admin/banned-companies", label: "Banned Cos", icon: <Ban className="h-4 w-4" /> },
  { path: "/admin/logs", label: "System Logs", icon: <ScrollText className="h-4 w-4" /> },
];

type Props = {
  role: string | null;
  collapsed: boolean;
  onToggle: () => void;
  pendingCount?: number;
};

function NavLink({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  const link = (
    <Link
      to={item.path}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
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
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {item.label}
          {item.badge != null && item.badge > 0 && ` (${item.badge})`}
        </TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

export default function Sidebar({ role, collapsed, onToggle, pendingCount = 0 }: Props) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/admin/dashboard") return location.pathname === "/admin/dashboard";
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const adminConfigItems: NavItem[] = ADMIN_CONFIG_NAV.map((item) => ({
    ...item,
    badge: item.path === "/admin/pending" ? pendingCount || undefined : undefined,
  }));

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "relative flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border transition-[width] duration-200 ease-in-out overflow-hidden",
          collapsed ? "w-[57px]" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-[60px] items-center border-b border-sidebar-border shrink-0 px-4 gap-3",
            collapsed && "justify-center px-2"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-foreground truncate">
              Aurex Viperion
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {role === "bidder" && (
            <>
              {!collapsed && (
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Menu
                </p>
              )}
              {BIDDER_NAV.map((item) => (
                <NavLink key={item.path} item={item} collapsed={collapsed} isActive={isActive(item.path)} />
              ))}
            </>
          )}

          {role === "caller" && (
            <>
              {!collapsed && (
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Menu
                </p>
              )}
              {CALLER_NAV.map((item) => (
                <NavLink key={item.path} item={item} collapsed={collapsed} isActive={isActive(item.path)} />
              ))}
            </>
          )}

          {role === "admin" && (
            <>
              {!collapsed && (
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Workspace
                </p>
              )}
              {ADMIN_MAIN_NAV.map((item) => (
                <NavLink key={item.path} item={item} collapsed={collapsed} isActive={isActive(item.path)} />
              ))}

              {!collapsed && (
                <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Administration
                </p>
              )}
              {collapsed && <div className="my-2 border-t border-sidebar-border" />}
              {adminConfigItems.map((item) => (
                <NavLink key={item.path} item={item} collapsed={collapsed} isActive={isActive(item.path)} />
              ))}
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={onToggle}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors",
              collapsed && "justify-center px-2"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
