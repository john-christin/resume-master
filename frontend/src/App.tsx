import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getUserRole } from "./auth";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import BannedCompaniesPage from "./pages/admin/BannedCompaniesPage";
import KnowledgeBasePage from "./pages/admin/KnowledgeBasePage";
import LogsPage from "./pages/admin/LogsPage";
import ModelsPage from "./pages/admin/ModelsPage";
import PendingPage from "./pages/admin/PendingPage";
import PricingPage from "./pages/admin/PricingPage";
import DocStylesPage from "./pages/admin/DocStylesPage";
import TechStacksPage from "./pages/admin/TechStacksPage";
import UsersPage from "./pages/admin/UsersPage";
import BatchJobStatus from "./pages/BatchJobStatus";
import BidderDashboard from "./pages/BidderDashboard";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import History from "./pages/History";
import Kanban from "./pages/Kanban";
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
  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (role === "bidder") return <Navigate to="/dashboard" replace />;
  if (role === "caller") return <Navigate to="/history" replace />;
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="/rejected" element={<Rejected />} />
        <Route path="/suspended" element={<Suspended />} />

        {/* Authenticated routes — all under AppLayout */}
        <Route element={<ProtectedRoute roles={["admin", "bidder", "caller"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<RoleRedirect />} />

            {/* Bidder */}
            <Route element={<ProtectedRoute roles={["bidder"]} />}>
              <Route path="/dashboard" element={<BidderDashboard />} />
            </Route>

            {/* Profiles — bidder + admin */}
            <Route element={<ProtectedRoute roles={["admin", "bidder"]} />}>
              <Route path="/profiles" element={<ProfileList />} />
              <Route path="/profiles/new" element={<ProfileEdit />} />
              <Route path="/profiles/:profileId" element={<ProfileEdit />} />
            </Route>

            {/* Generate — bidder + admin */}
            <Route element={<ProtectedRoute roles={["admin", "bidder"]} />}>
              <Route path="/generate" element={<JobInput />} />
              <Route path="/preview/:applicationId" element={<Preview />} />
              <Route path="/batch-jobs/:jobId" element={<BatchJobStatus />} />
            </Route>

            {/* Shared — all approved roles */}
            <Route path="/history" element={<History />} />
            <Route path="/history/:appId" element={<ApplicationDetailPage />} />
            <Route path="/calls" element={<Kanban />} />
            <Route path="/settings" element={<Settings />} />

            {/* Admin routes */}
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/pending" element={<PendingPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/pricing" element={<PricingPage />} />
              <Route path="/admin/stacks" element={<TechStacksPage />} />
              <Route path="/admin/doc-styles" element={<DocStylesPage />} />
              <Route path="/admin/kb" element={<KnowledgeBasePage />} />
              <Route path="/admin/models" element={<ModelsPage />} />
              <Route path="/admin/banned-companies" element={<BannedCompaniesPage />} />
              <Route path="/admin/logs" element={<LogsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
