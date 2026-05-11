import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getUserRole } from "./auth";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/AdminDashboard";
import BatchJobStatus from "./pages/BatchJobStatus";
import History from "./pages/History";
import JobInput from "./pages/JobInput";
import Login from "./pages/Login";
import PendingApproval from "./pages/PendingApproval";
import Preview from "./pages/Preview";
import ProfileEdit from "./pages/ProfileEdit";
import ProfileList from "./pages/ProfileList";
import Register from "./pages/Register";
import Rejected from "./pages/Rejected";
import Settings from "./pages/Settings";
import Suspended from "./pages/Suspended";

function RoleRedirect() {
  const role = getUserRole();
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "caller") return <Navigate to="/history" replace />;
  return <Navigate to="/profiles" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="/rejected" element={<Rejected />} />
        <Route path="/suspended" element={<Suspended />} />

        <Route element={<ProtectedRoute roles={["admin", "bidder", "caller"]} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<RoleRedirect />} />

            {/* Profiles - bidder + admin */}
            <Route element={<ProtectedRoute roles={["admin", "bidder"]} />}>
              <Route path="/profiles" element={<ProfileList />} />
              <Route path="/profiles/new" element={<ProfileEdit />} />
              <Route path="/profiles/:profileId" element={<ProfileEdit />} />
            </Route>

            {/* Generate - bidder + admin */}
            <Route element={<ProtectedRoute roles={["admin", "bidder"]} />}>
              <Route path="/generate" element={<JobInput />} />
              <Route path="/preview/:applicationId" element={<Preview />} />
              <Route path="/batch-jobs/:jobId" element={<BatchJobStatus />} />
            </Route>

            {/* History - all approved roles */}
            <Route path="/history" element={<History />} />

            {/* Settings - all approved roles */}
            <Route path="/settings" element={<Settings />} />

            {/* Admin dashboard */}
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
