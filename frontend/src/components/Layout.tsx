import {
  ChevronDown,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Moon,
  Phone,
  Search,
  Settings,
  Settings2,
  Sun,
  SunMoon,
  User,
  Users,
  Wand2,
} from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getUsername, getUserRole } from "../auth";
import { useTheme } from "../ThemeContext";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const NAV_ICONS: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="h-4 w-4" />,
  Settings: <Settings2 className="h-4 w-4" />,
  Profiles: <User className="h-4 w-4" />,
  Generate: <Wand2 className="h-4 w-4" />,
  History: <History className="h-4 w-4" />,
  Search: <Search className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Calls: <Phone className="h-4 w-4" />,
};

const ROLE_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "info" | "purple"
> = {
  admin: "purple",
  bidder: "info",
  caller: "success",
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const username = getUsername();
  const role = getUserRole();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const navItems: { path: string; label: string }[] = [];
  if (role === "admin") {
    navItems.push({ path: "/admin/dashboard", label: "Dashboard" });
    navItems.push({ path: "/profiles", label: "Profiles" });
    navItems.push({ path: "/generate", label: "Generate" });
    navItems.push({ path: "/history", label: "History" });
    navItems.push({ path: "/calls", label: "Calls" });
  } else if (role === "caller") {
    navItems.push({ path: "/history", label: "Search" });
    navItems.push({ path: "/calls", label: "Calls" });
  } else {
    navItems.push({ path: "/dashboard", label: "Dashboard" });
    navItems.push({ path: "/profiles", label: "Profiles" });
    navItems.push({ path: "/generate", label: "Generate" });
    navItems.push({ path: "/history", label: "History" });
    navItems.push({ path: "/calls", label: "Calls" });
  }

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : "?";

  const ThemeIcon =
    theme === "dark" ? Moon : theme === "light" ? Sun : SunMoon;

  return (
    <div className="min-h-screen bg-muted/20">
      <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground hidden sm:block">
                Aurex Viperion
              </span>
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive =
                  item.path === "/admin/dashboard"
                    ? location.pathname.startsWith("/admin")
                    : location.pathname === item.path ||
                      location.pathname.startsWith(item.path + "/");
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {NAV_ICONS[item.label]}
                    <span className="hidden md:block">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ThemeIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">
                    Appearance
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={(v) =>
                      setTheme(v as "light" | "dark" | "system")
                    }
                  >
                    <DropdownMenuRadioItem value="light">
                      <Sun className="mr-2 h-3.5 w-3.5" />
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <Moon className="mr-2 h-3.5 w-3.5" />
                      Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <SunMoon className="mr-2 h-3.5 w-3.5" />
                      System
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 h-8 px-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">
                      {username}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium truncate">{username}</span>
                      <Badge
                        variant={ROLE_VARIANT[role ?? "bidder"] ?? "default"}
                        className="w-fit text-[10px] px-1.5 py-0"
                      >
                        {role}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {location.pathname.startsWith("/admin") ? (
        <Outlet />
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </main>
      )}
    </div>
  );
}
