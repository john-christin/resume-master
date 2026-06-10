import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Moon,
  Palette,
  Sun,
  SunMoon,
  User,
  XCircle,
} from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import { useState } from "react";
import { resetPassword, updateUsername } from "../api/user";
import { getUsername } from "../auth";
import { useTheme } from "../ThemeContext";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";

type Msg = { type: "success" | "error"; text: string } | null;

function StatusAlert({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <Alert variant={msg.type === "success" ? "success" : "destructive"}>
      {msg.type === "success" ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      <AlertDescription>{msg.text}</AlertDescription>
    </Alert>
  );
}

export default function Settings() {
  const [username, setUsername] = useState(getUsername() ?? "");
  const [usernameMsg, setUsernameMsg] = useState<Msg>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<Msg>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const { theme, setTheme } = useTheme();

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameMsg(null);
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setUsernameMsg({ type: "error", text: "Username must be at least 2 characters" });
      return;
    }
    setUsernameSaving(true);
    try {
      await updateUsername(trimmed);
      localStorage.setItem("user_username", trimmed);
      setUsernameMsg({ type: "success", text: "Username updated successfully" });
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setUsernameMsg({ type: "error", text: detail || "Failed to update username" });
    } finally {
      setUsernameSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match" });
      return;
    }
    setPasswordSaving(true);
    try {
      await resetPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "success", text: "Password updated successfully" });
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setPasswordMsg({ type: "error", text: detail || "Failed to update password" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const THEMES = [
    { value: "light" as const, label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark" as const, label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system" as const, label: "System", icon: <SunMoon className="h-4 w-4" /> },
  ];

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" description="Manage your account preferences" />

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm font-medium transition-all ${
                  theme === t.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Update User ID */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Update User ID
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusAlert msg={usernameMsg} />
          <form onSubmit={handleUsernameSubmit} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter new user ID"
                required
              />
            </div>
            <Button type="submit" disabled={usernameSaving}>
              {usernameSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Update User ID"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Reset Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Reset Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusAlert msg={passwordMsg} />
          <form onSubmit={handlePasswordSubmit} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
              />
            </div>
            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
