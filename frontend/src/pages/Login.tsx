import { FileText, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { saveAuth } from "../auth";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login({ username, password });
      const d = res.data;
      saveAuth(d.access_token, d.user_id, d.username, d.role, d.status);

      if (d.status === "pending") navigate("/pending");
      else if (d.status === "rejected") navigate("/rejected");
      else if (d.role === "admin") navigate("/admin");
      else if (d.role === "caller") navigate("/history");
      else if (d.profile_count > 0) navigate("/generate");
      else navigate("/profiles");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(detail ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — aurora dark */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-[#06060f] flex-col justify-between p-10">
        {/* Blobs */}
        <div className="absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full bg-violet-600/25 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-indigo-700/20 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-56 h-56 rounded-full bg-purple-500/15 blur-[80px] pointer-events-none" />
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
            AI-powered resume tailoring at your fingertips
          </h2>
          <p className="text-white/40 text-sm leading-relaxed">
            Generate tailored resumes and cover letters in seconds. Track your
            applications, manage interview pipelines, and let AI do the heavy lifting.
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

        <div className="relative z-10 w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/15">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-base text-white">Aurex Viperion</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Sign in</h1>
          <p className="text-white/40 text-sm mb-7">
            Enter your credentials to access your workspace.
          </p>

          {error && (
            <Alert variant="destructive" className="mb-5 bg-rose-500/10 border-rose-500/20 text-rose-300">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-white/60 text-xs font-medium uppercase tracking-wider">User ID</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your user ID"
                required
                autoFocus
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/60 text-xs font-medium uppercase tracking-wider">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 h-11"
              />
            </div>
            <Button
              type="submit"
              className="w-full mt-1 h-11 bg-violet-600 hover:bg-violet-500 text-white border-0 shadow-lg shadow-violet-900/40"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-white/30 mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-violet-400 hover:text-violet-300 font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
