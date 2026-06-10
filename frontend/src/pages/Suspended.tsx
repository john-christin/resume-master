import { FileText, ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import { Button } from "../components/ui/button";

export default function Suspended() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden bg-[#0a0a0f]">
      {/* Aurora blobs */}
      <div className="absolute -top-20 left-1/4 w-[460px] h-[460px] rounded-full bg-indigo-600/18 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-28 right-1/4 w-[500px] h-[500px] rounded-full bg-slate-600/20 blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 -left-20 w-56 h-56 rounded-full bg-violet-700/15 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-10 w-44 h-44 rounded-full bg-blue-700/12 blur-[70px] pointer-events-none" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Noise grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 border border-indigo-500/25">
            <FileText className="h-4 w-4 text-indigo-400" />
          </div>
          <span className="text-sm font-semibold text-white/60 tracking-wide">Aurex Viperion</span>
        </div>

        <div className="backdrop-blur-2xl bg-white/[0.04] border border-white/10 rounded-2xl p-8 text-center shadow-[0_8px_64px_rgba(0,0,0,0.5)]">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl scale-150" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <ShieldOff className="h-7 w-7 text-indigo-400" />
              </div>
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span className="text-xs font-medium text-indigo-400 tracking-wide">Access Restricted</span>
          </div>

          <h1 className="text-xl font-semibold text-white mb-2">Account Suspended</h1>
          <p className="text-sm text-white/40 leading-relaxed mb-6">
            Your account access has been restricted by an administrator. Please contact your organization's admin for more information.
          </p>

          <Button
            variant="outline"
            className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"
            onClick={() => { clearAuth(); navigate("/login"); }}
          >
            Back to Login
          </Button>
        </div>

        <p className="text-center text-xs text-white/20 mt-5">
          © {new Date().getFullYear()} Aurex Viperion
        </p>
      </div>
    </div>
  );
}
