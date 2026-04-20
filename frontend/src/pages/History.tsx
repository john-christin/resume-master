import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deleteApplication, getApplication, getApplications } from "../api/applications";
import { getUserRole } from "../auth";
import LoadingSpinner from "../components/LoadingSpinner";
import Pagination from "../components/Pagination";
import type { ApplicationDetail, ApplicationSummary, PaginatedApplications } from "../types";

export default function History() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getUserRole();
  const batchResult = (location.state as { batchResult?: { count: number; totalCost: number } })
    ?.batchResult;

  const [data, setData] = useState<PaginatedApplications | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    batchResult
      ? `Successfully generated ${batchResult.count} applications`
      : null
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [searchInput, setSearchInput] = useState("");

  // Expanded row state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ApplicationDetail | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await getApplications(page, pageSize, search || undefined, sortBy, sortDir);
      setData(res.data);
    } catch {
      setError("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [page, pageSize, search, sortBy, sortDir]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleDelete = async (appId: string) => {
    if (!window.confirm("Are you sure you want to delete this application?"))
      return;
    try {
      await deleteApplication(appId);
      if (expandedId === appId) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      await loadApplications();
    } catch {
      setError("Failed to delete application");
    }
  };

  const handleRowClick = async (appId: string) => {
    if (expandedId === appId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(appId);
    setExpandedDetail(null);
    setExpandLoading(true);
    try {
      const res = await getApplication(appId);
      setExpandedDetail(res.data);
    } catch {
      setError("Failed to load application details");
      setExpandedId(null);
    } finally {
      setExpandLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => setPage(newPage);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <span className="text-gray-300 dark:text-gray-600 ml-1">&#8597;</span>;
    return <span className="text-blue-600 dark:text-blue-400 ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  };

  if (loading && !data) return <LoadingSpinner message="Loading applications..." />;

  const applications: ApplicationSummary[] = data?.items || [];
  const isCaller = role === "caller";
  const showCost = role === "admin";

  // Count columns for detail row colSpan
  let colCount = 5; // title, company, profile, date, actions
  if (role === "caller" || role === "admin") colCount++; // user
  if (role === "admin") colCount++; // location
  if (showCost) colCount++;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isCaller ? "Search Applications" : "Application History"}
        </h1>
        {!isCaller && (
          <button
            onClick={() => navigate("/generate")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Generate New
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-md text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Search by job title, company, URL, profile..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm"
          >
            Clear
          </button>
        )}
      </form>

      {applications.length === 0 && !loading ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {search ? "No applications match your search." : "No applications yet."}
          </p>
          {!search && !isCaller && (
            <button
              onClick={() => navigate("/generate")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Generate Your First Application
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th
                    className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white"
                    onClick={() => handleSort("job_title")}
                  >
                    Job Title <SortIcon column="job_title" />
                  </th>
                  <th
                    className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white"
                    onClick={() => handleSort("company")}
                  >
                    Company <SortIcon column="company" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Profile
                  </th>
                  {role === "admin" && (
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Location
                    </th>
                  )}
                  {(role === "caller" || role === "admin") && (
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      User
                    </th>
                  )}
                  {showCost && (
                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Cost
                    </th>
                  )}
                  <th
                    className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white"
                    onClick={() => handleSort("created_at")}
                  >
                    Date <SortIcon column="created_at" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <>
                    <tr
                      key={app.id}
                      className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                        expandedId === app.id ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
                      }`}
                      onClick={() => handleRowClick(app.id)}
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium max-w-[200px] truncate">
                        <span className="mr-1.5 text-gray-400 dark:text-gray-500 text-xs">
                          {expandedId === app.id ? "\u25BC" : "\u25B6"}
                        </span>
                        {app.job_title}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {app.company || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {app.profile_name || "-"}
                      </td>
                      {role === "admin" && (
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {app.location || "-"}
                        </td>
                      )}
                      {(role === "caller" || role === "admin") && (
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {app.user_username || "-"}
                        </td>
                      )}
                      {showCost && (
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {app.total_cost != null
                            ? `$${app.total_cost.toFixed(4)}`
                            : "-"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {app.resume_path && (
                            <a
                              href={`/api/download/${app.resume_path.split("/").pop()}`}
                              className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs hover:bg-green-100 dark:hover:bg-green-900/50"
                            >
                              Resume
                            </a>
                          )}
                          {app.cover_letter_path && (
                            <a
                              href={`/api/download/${app.cover_letter_path.split("/").pop()}`}
                              className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs hover:bg-purple-100 dark:hover:bg-purple-900/50"
                            >
                              Cover
                            </a>
                          )}
                          {!isCaller && (
                            <button
                              onClick={() => handleDelete(app.id)}
                              className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs hover:bg-red-100 dark:hover:bg-red-900/50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedId === app.id && (
                      <tr key={`${app.id}-detail`} className="bg-gray-50/50 dark:bg-gray-800/80">
                        <td colSpan={colCount} className="px-6 py-4">
                          {expandLoading ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400" />
                              Loading details...
                            </div>
                          ) : expandedDetail ? (
                            <div className="space-y-3">
                              {/* Job URL */}
                              {expandedDetail.job_url && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Job Link
                                  </span>
                                  <a
                                    href={expandedDetail.job_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block mt-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all"
                                  >
                                    {expandedDetail.job_url}
                                  </a>
                                </div>
                              )}

                              {/* Job Description */}
                              <div>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                  Job Description
                                </span>
                                <div className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-3 max-h-64 overflow-y-auto">
                                  {expandedDetail.job_description}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {data && (
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              pageSize={pageSize}
              total={data.total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </>
      )}
    </div>
  );
}
