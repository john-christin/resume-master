import { Navigate, Outlet } from "react-router-dom";
import { getUserRole, getUserStatus, isAuthenticated } from "../auth";

interface Props {
  roles?: string[];
}

export default function ProtectedRoute({ roles }: Props) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const status = getUserStatus();
  if (status === "pending") {
    return <Navigate to="/pending" replace />;
  }
  if (status === "rejected") {
    return <Navigate to="/rejected" replace />;
  }

  if (roles && roles.length > 0) {
    const role = getUserRole();
    if (!roles.includes(role)) {
      // Redirect to appropriate default based on role
      if (role === "caller") return <Navigate to="/history" replace />;
      if (role === "admin") return <Navigate to="/admin" replace />;
      return <Navigate to="/profiles" replace />;
    }
  }

  return <Outlet />;
}
