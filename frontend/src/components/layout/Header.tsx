import {
  LogOut,
  Moon,
  Settings,
  Sun,
  SunMoon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { clearAuth, getUsername, getUserRole } from "@/auth";
import { useTheme } from "@/ThemeContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_VARIANT: Record<string, "default" | "success" | "warning" | "info" | "purple"> = {
  admin: "purple",
  bidder: "info",
  caller: "success",
};

export default function Header() {
  const navigate = useNavigate();
  const username = getUsername();
  const role = getUserRole();
  const { theme, setTheme } = useTheme();

  const initials = username ? username.slice(0, 2).toUpperCase() : "?";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : SunMoon;

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6 gap-4">
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Appearance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
            >
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-3.5 w-3.5" /> Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-3.5 w-3.5" /> Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <SunMoon className="mr-2 h-3.5 w-3.5" /> System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-8 px-2 hover:bg-accent/60">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[11px] font-semibold bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
                {username}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
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
    </header>
  );
}
