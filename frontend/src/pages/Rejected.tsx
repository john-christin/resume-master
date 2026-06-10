import { FileText, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import { Button } from "../components/ui/button";

export default function Rejected() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden bg-[#0a0a0f]">
      {/* Aurora blobs */}
      <div className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full bg-rose-600/18 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-[440px] h-[440px] rounded-full bg-red-700/15 blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full bg-rose-500/10 blur-[80px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/3 w-48 h-48 rounded-full bg-orange-600/12 blur-[70px] pointer-events-none" />

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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 border border-rose-500/25">
            <FileText className="h-4 w-4 text-rose-400" />
          </div>
          <span className="text-sm font-semibold text-white/60 tracking-wide">Aurex Viperion</span>
        </div>

        <div className="backdrop-blur-2xl bg-white/[0.04] border border-white/10 rounded-2xl p-8 text-center shadow-[0_8px_64px_rgba(0,0,0,0.5)]">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-rose-500/25 blur-xl scale-150" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/12 border border-rose-500/20">
                <XCircle className="h-7 w-7 text-rose-400" />
              </div>
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span className="text-xs font-medium text-rose-400 tracking-wide">Not Approved</span>
          </div>

          <h1 className="text-xl font-semibold text-white mb-2">Account Rejected</h1>
          <p className="text-sm text-white/40 leading-relaxed mb-6">
            Your registration was not approved by an administrator. Please contact your organization's admin for further assistance.
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
