import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getUserRole } from "./auth";
import AdminLayout from "./components/AdminLayout";
import Layout from "./components/Layout";
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
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="/rejected" element={<Rejected />} />
        <Route path="/suspended" element={<Suspended />} />

        <Route element={<ProtectedRoute roles={["admin", "bidder", "caller"]} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<RoleRedirect />} />

            {/* Bidder dashboard */}
            <Route element={<ProtectedRoute roles={["bidder"]} />}>
              <Route path="/dashboard" element={<BidderDashboard />} />
            </Route>

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
            <Route path="/history/:appId" element={<ApplicationDetailPage />} />

            {/* Call Board - all approved roles */}
            <Route path="/calls" element={<Kanban />} />

            {/* Settings - all approved roles */}
            <Route path="/settings" element={<Settings />} />

            {/* Admin routes — nested under AdminLayout for left sidebar */}
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="pending" element={<PendingPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path="stacks" element={<TechStacksPage />} />
                <Route path="doc-styles" element={<DocStylesPage />} />
                <Route path="kb" element={<KnowledgeBasePage />} />
                <Route path="models" element={<ModelsPage />} />
                <Route path="banned-companies" element={<BannedCompaniesPage />} />
                <Route path="logs" element={<LogsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
