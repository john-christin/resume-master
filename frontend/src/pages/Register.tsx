import { Check, FileText, Loader2, Wand2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import { saveAuth } from "../auth";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { cn } from "../lib/utils";

type Rule = { label: string; test: (p: string) => boolean };

const RULES: Rule[] = [
  { label: "At least 8 characters",       test: (p) => p.length >= 8 },
  { label: "Uppercase letter (A–Z)",       test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a–z)",       test: (p) => /[a-z]/.test(p) },
  { label: "Number (0–9)",                 test: (p) => /[0-9]/.test(p) },
  { label: "Special character (!@#$…)",    test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong", "Strong"] as const;
const STRENGTH_COLOR = [
  "",
  "bg-rose-500",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-emerald-400",
  "bg-emerald-400",
] as const;

function usePasswordStrength(password: string) {
  return useMemo(() => {
    const passed = RULES.filter((r) => r.test(password)).length;
    return { passed, score: password ? passed : 0 };
  }, [password]);
}

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { passed, score } = usePasswordStrength(password);
  const allPassed = passed === RULES.length;
  const canSubmit = allPassed && password === confirmPassword && username.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!allPassed) {
      setError("Password does not meet all requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await register({ username, password });
      const d = res.data;
      saveAuth(d.access_token, d.user_id, d.username, d.role, d.status);
      if (d.status === "approved") navigate("/profiles");
      else navigate("/pending");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(detail ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — aurora dark */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-[#06060f] flex-col justify-between p-10">
        {/* Blobs */}
        <div className="absolute -top-16 -right-16 w-[400px] h-[400px] rounded-full bg-violet-600/22 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-[380px] h-[380px] rounded-full bg-indigo-700/18 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-52 h-52 rounded-full bg-purple-500/13 blur-[80px] pointer-events-none" />
        {/* Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/15">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-white/80 font-semibold text-base tracking-wide">Aurex Viperion</span>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 border border-violet-500/30 mb-6">
            <Wand2 className="h-6 w-6 text-violet-300" />
          </div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Start your AI-powered job search today
          </h2>
          <p className="text-white/40 text-sm leading-relaxed">
            Create an account and get access to AI-powered resume tailoring,
            application tracking, and interview pipeline management.
          </p>
        </div>

        <p className="relative z-10 text-white/20 text-xs">
          © {new Date().getFullYear()} Aurex Viperion
        </p>
      </div>

      {/* Right panel — clean dark form */}
      <div className="flex-1 relative flex items-center justify-center px-6 py-12 bg-[#0a0a0f] overflow-hidden">
        {/* Subtle corner blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-violet-700/8 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-indigo-700/8 blur-[80px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/15">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-base text-white">Aurex Viperion</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
          <p className="text-white/40 text-sm mb-7">
            Fill in the details below to get started.
          </p>

          {error && (
            <Alert variant="destructive" className="mb-5 bg-rose-500/10 border-rose-500/20 text-rose-300">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-white/60 text-xs font-medium uppercase tracking-wider">
                User ID
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a user ID"
                required
                autoFocus
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 h-11"
              />
            </div>

            {/* Password field + strength meter */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/60 text-xs font-medium uppercase tracking-wider">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordTouched(true)}
                placeholder="Create a strong password"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 h-11"
              />

              {/* Strength bar */}
              {passwordTouched && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-1">
                    {RULES.map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-all duration-300",
                          i < score ? STRENGTH_COLOR[score] : "bg-white/10"
                        )}
                      />
                    ))}
                  </div>
                  {score > 0 && (
                    <p className={cn(
                      "text-xs font-medium",
                      score <= 1 ? "text-rose-400" :
                      score === 2 ? "text-orange-400" :
                      score === 3 ? "text-yellow-400" :
                      "text-emerald-400"
                    )}>
                      {STRENGTH_LABEL[score]}
                    </p>
                  )}

                  {/* Requirements checklist */}
                  <ul className="space-y-1 pt-0.5">
                    {RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <li key={rule.label} className="flex items-center gap-2">
                          <span className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                            ok ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/25"
                          )}>
                            {ok
                              ? <Check className="h-2.5 w-2.5" strokeWidth={3} />
                              : <X className="h-2.5 w-2.5" strokeWidth={3} />
                            }
                          </span>
                          <span className={cn(
                            "text-xs transition-colors",
                            ok ? "text-white/60" : "text-white/35"
                          )}>
                            {rule.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-white/60 text-xs font-medium uppercase tracking-wider">
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                className={cn(
                  "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 h-11",
                  confirmPassword.length > 0 && password !== confirmPassword && "border-rose-500/40"
                )}
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-rose-400">Passwords do not match.</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-1 h-11 bg-violet-600 hover:bg-violet-500 text-white border-0 shadow-lg shadow-violet-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-white/30 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
