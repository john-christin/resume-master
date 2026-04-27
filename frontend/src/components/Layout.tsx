import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getUsername, getUserRole } from "../auth";
import { useTheme } from "../ThemeContext";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const username = getUsername();
  const role = getUserRole();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const navItems: { path: string; label: string }[] = [];
  if (role === "admin") {
    navItems.push({ path: "/admin", label: "Dashboard" });
    navItems.push({ path: "/profiles", label: "Profiles" });
    navItems.push({ path: "/generate", label: "Generate" });
    navItems.push({ path: "/history", label: "History" });
  } else if (role === "caller") {
    navItems.push({ path: "/history", label: "Search" });
  } else {
    // bidder
    navItems.push({ path: "/profiles", label: "Profiles" });
    navItems.push({ path: "/generate", label: "Generate" });
    navItems.push({ path: "/history", label: "History" });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold text-gray-900 dark:text-white">
              Aurex Viperion
            </Link>
            <div className="flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="ml-4 pl-4 border-l border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                {/* Theme toggle */}
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
                  className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded border-0 cursor-pointer"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {role}
                </span>
                <Link
                  to="/settings"
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white max-w-[150px] truncate"
                >
                  {username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
