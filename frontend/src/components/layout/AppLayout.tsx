import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getUserRole } from "@/auth";
import { getUsers } from "@/api/admin";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppLayout() {
  const role = getUserRole();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "1"
  );
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (role === "admin") {
      getUsers("pending")
        .then((r) => setPendingCount(r.data.length))
        .catch(() => {});
    }
  }, [role, location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Fixed aurora blobs — visible through the main scroll area */}
      <div className="fixed top-0 right-0 w-[700px] h-[700px] rounded-full bg-violet-600/[0.055] blur-[160px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-700/[0.045] blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-purple-600/[0.03] blur-[120px] pointer-events-none z-0" />

      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        pendingCount={pendingCount}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative z-10">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
