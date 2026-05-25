import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Phone,
  Search,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  deleteApplication,
  getApplication,
  getApplications,
  updateCallStatus,
} from "../api/applications";
import { getTechStacksPublic } from "../api/profile";
import { getUserRole } from "../auth";
import ApplicationChatSidebar from "../components/ApplicationChatSidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import Pagination from "../components/Pagination";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import type {
  ApplicationDetail,
  ApplicationSummary,
  PaginatedApplications,
  TechStack,
} from "../types";

async function smartDownload(url: string, filename: string): Promise<void> {
  if ("showSaveFilePicker" in window) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("fetch failed");
      const blob = await response.blob();
      const ext = filename.endsWith(".docx") ? ".docx" : ".pdf";
      const mimeType =
        ext === ".docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Document", accept: { [mimeType]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("resume-master-dl", 1);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore("handles");
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function loadSavedDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return await new Promise((resolve) => {
      const req = db.transaction("handles").objectStore("handles").get("download-dir");
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function persistDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "download-dir");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function smartDownloadBoth(
  resumeUrl: string,
  resumeFilename: string,
  coverUrl: string,
  coverFilename: string,
  onSuccess: (msg: string) => void
): Promise<void> {
  if ("showDirectoryPicker" in window) {
    try {
      const [resumeBlob, coverBlob] = await Promise.all([
        fetch(resumeUrl).then((r) => r.blob()),
        fetch(coverUrl).then((r) => r.blob()),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let dirHandle: any = await loadSavedDirHandle();
      if (dirHandle) {
        try {
          const perm = await dirHandle.requestPermission({ mode: "readwrite" });
          if (perm !== "granted") dirHandle = null;
        } catch {
          dirHandle = null;
        }
      }
      if (!dirHandle) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
        await persistDirHandle(dirHandle);
      }
      for (const [blob, name] of [
        [resumeBlob, resumeFilename],
        [coverBlob, coverFilename],
      ] as [Blob, string][]) {
        const fileHandle = await dirHandle.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
      onSuccess("Resume and cover letter downloaded successfully.");
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  await smartDownload(resumeUrl, resumeFilename);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await smartDownload(coverUrl, coverFilename);
  onSuccess("Resume and cover letter downloaded.");
}

type FormatPicker = {
  type: "both" | "resume" | "cover";
  resumeFile: string | null;
  coverFile: string | null;
  profileName: string;
};

export default function History() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getUserRole();
  const batchResult = (
    location.state as { batchResult?: { count: number; totalCost: number } }
  )?.batchResult;

  const [data, setData] = useState<PaginatedApplications | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    batchResult ? `Successfully generated ${batchResult.count} applications` : null
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [searchInput, setSearchInput] = useState("");
  const [techStackFilter, setTechStackFilter] = useState("");
  const [techStacks, setTechStacks] = useState<TechStack[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ApplicationDetail | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  const [callStatus, setCallStatus] = useState<Record<string, boolean>>({});
  const [formatPicker, setFormatPicker] = useState<FormatPicker | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [chatApp, setChatApp] = useState<{ id: string; jobTitle: string; company?: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    getTechStacksPublic()
      .then((res) => setTechStacks(res.data))
      .catch(() => {});
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await getApplications(
        page,
        pageSize,
        search || undefined,
        sortBy,
        sortDir,
        techStackFilter || undefined
      );
      setData(res.data);
    } catch {
      setError("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [page, pageSize, search, sortBy, sortDir, techStackFilter]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) setSortDir((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortBy(column); setSortDir("asc"); }
    setPage(1);
  };

  const handleDelete = async (appId: string) => {
    if (!window.confirm("Delete this application?")) return;
    try {
      await deleteApplication(appId);
      if (expandedId === appId) { setExpandedId(null); setExpandedDetail(null); }
      await loadApplications();
    } catch {
      setError("Failed to delete application");
    }
  };

  const handleRowClick = async (appId: string) => {
    if (expandedId === appId) { setExpandedId(null); setExpandedDetail(null); return; }
    setExpandedId(appId);
    setExpandedDetail(null);
    setExpandLoading(true);
    try {
      const res = await getApplication(appId);
      setExpandedDetail(res.data);
    } catch {
      setError("Failed to load details");
      setExpandedId(null);
    } finally {
      setExpandLoading(false);
    }
  };

  const handleCallToggle = async (appId: string, current: boolean) => {
    const next = !current;
    setCallStatus((p) => ({ ...p, [appId]: next }));
    try { await updateCallStatus(appId, next); }
    catch { setCallStatus((p) => ({ ...p, [appId]: current })); }
  };

  const handleFormatPick = (fmt: "pdf" | "docx") => {
    if (!formatPicker) return;
    const { type, resumeFile, coverFile, profileName: sn } = formatPicker;
    setFormatPicker(null);
    const toFile = (raw: string, label: string, ext: string) => {
      const base = raw.replace(/\.(pdf|docx)$/, "");
      return { url: `/api/download/${base}.${ext}?name=${sn}_${label}.${ext}`, name: `${sn}_${label}.${ext}` };
    };
    if (type === "both" && resumeFile && coverFile) {
      const r = toFile(resumeFile, "Resume", fmt);
      const c = toFile(coverFile, "Cover_Letter", fmt);
      smartDownloadBoth(r.url, r.name, c.url, c.name, setToast);
    } else if (type === "resume" && resumeFile) {
      const r = toFile(resumeFile, "Resume", fmt);
      smartDownload(r.url, r.name);
    } else if (type === "cover" && coverFile) {
      const c = toFile(coverFile, "Cover_Letter", fmt);
      smartDownload(c.url, c.name);
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3 w-3 ml-1 text-primary" />
    ) : (
      <ChevronDown className="inline h-3 w-3 ml-1 text-primary" />
    );
  };

  if (loading && !data) return <LoadingSpinner message="Loading applications..." />;

  const applications: ApplicationSummary[] = data?.items || [];
  const isCaller = role === "caller";
  const showCost = role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isCaller ? "Search Applications" : "Application History"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data?.total ?? 0} application{data?.total !== 1 ? "s" : ""}
          </p>
        </div>
        {!isCaller && (
          <Button onClick={() => navigate("/generate")}>
            <Wand2 className="h-4 w-4" />
            Generate New
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {successMsg}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-2"
              onClick={() => setSuccessMsg(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by job title, company, profile..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </form>
        {techStacks.length > 0 && (
          <Select
            value={techStackFilter || "all"}
            onValueChange={(v) => { setTechStackFilter(v === "all" ? "" : v); setPage(1); }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Tech Stacks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tech Stacks</SelectItem>
              {techStacks.map((ts) => (
                <SelectItem key={ts.id} value={ts.id}>{ts.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {applications.length === 0 && !loading ? (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              {search ? "No applications match your search." : "No applications yet."}
            </p>
            {!search && !isCaller && (
              <Button onClick={() => navigate("/generate")}>
                <Wand2 className="h-4 w-4" />
                Generate Your First Application
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("job_title")}
                  >
                    Job Title <SortIcon column="job_title" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("company")}
                  >
                    Company <SortIcon column="company" />
                  </TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("created_at")}
                  >
                    Date <SortIcon column="created_at" />
                  </TableHead>
                  {!isCaller && (
                    <TableHead className="text-center">
                      <Phone className="h-3.5 w-3.5 inline" />
                    </TableHead>
                  )}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => {
                  const scheduled =
                    callStatus[app.id] !== undefined
                      ? callStatus[app.id]
                      : (app.call_scheduled ?? false);
                  const isExpanded = expandedId === app.id;
                  return (
                    <>
                      <TableRow
                        key={app.id}
                        className={`cursor-pointer ${isExpanded ? "bg-accent/30" : ""}`}
                        onClick={() => handleRowClick(app.id)}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            {app.job_title}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {app.company ? (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {app.company}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {app.profile_name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(app.created_at).toLocaleDateString()}
                        </TableCell>
                        {!isCaller && (
                          <TableCell
                            className="text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={scheduled}
                              onCheckedChange={() =>
                                handleCallToggle(app.id, scheduled)
                              }
                              className="scale-75"
                            />
                          </TableCell>
                        )}
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1">
                            {app.resume_path && app.cover_letter_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-1.5"
                                onClick={() => {
                                  const sn = (app.profile_name ?? "Resume").trim().replace(/\s+/g, "_");
                                  setFormatPicker({
                                    type: "both",
                                    resumeFile: app.resume_path!.split("/").pop()!,
                                    coverFile: app.cover_letter_path!.split("/").pop()!,
                                    profileName: sn,
                                  });
                                }}
                              >
                                <Download className="h-3 w-3" />
                                Both
                              </Button>
                            )}
                            {app.resume_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
                                onClick={() => {
                                  const sn = (app.profile_name ?? "Resume").trim().replace(/\s+/g, "_");
                                  setFormatPicker({ type: "resume", resumeFile: app.resume_path!.split("/").pop()!, coverFile: null, profileName: sn });
                                }}
                              >
                                Resume
                              </Button>
                            )}
                            {app.cover_letter_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800"
                                onClick={() => {
                                  const sn = (app.profile_name ?? "Resume").trim().replace(/\s+/g, "_");
                                  setFormatPicker({ type: "cover", resumeFile: null, coverFile: app.cover_letter_path!.split("/").pop()!, profileName: sn });
                                }}
                              >
                                Cover
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-primary"
                              title="Interview prep chat"
                              onClick={() =>
                                setChatApp({ id: app.id, jobTitle: app.job_title, company: app.company })
                              }
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                            {!isCaller && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(app.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow key={`${app.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell
                            colSpan={isCaller ? 5 : 6}
                            className="px-6 py-4"
                          >
                            {expandLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading details...
                              </div>
                            ) : expandedDetail ? (
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {expandedDetail.tech_stack_name && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                        Tech Stack
                                      </p>
                                      <Badge variant="purple">
                                        {expandedDetail.tech_stack_name}
                                      </Badge>
                                    </div>
                                  )}
                                  {expandedDetail.location && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                        Location
                                      </p>
                                      <span className="text-sm">{expandedDetail.location}</span>
                                    </div>
                                  )}
                                  {(role === "caller" || role === "admin") &&
                                    expandedDetail.user_username && (
                                      <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                          User
                                        </p>
                                        <span className="text-sm">{expandedDetail.user_username}</span>
                                      </div>
                                    )}
                                  {showCost && expandedDetail.total_cost != null && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                        Cost
                                      </p>
                                      <span className="text-sm">${expandedDetail.total_cost.toFixed(4)}</span>
                                    </div>
                                  )}
                                </div>

                                {expandedDetail.job_url && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                      Job Link
                                    </p>
                                    <a
                                      href={expandedDetail.job_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline break-all"
                                    >
                                      {expandedDetail.job_url}
                                    </a>
                                  </div>
                                )}

                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                    Job Description
                                  </p>
                                  <div className="text-sm text-foreground/80 whitespace-pre-wrap bg-background border rounded-md p-3 max-h-64 overflow-y-auto leading-relaxed">
                                    {expandedDetail.job_description}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {data && (
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              pageSize={pageSize}
              total={data.total}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </>
      )}

      {/* Format picker dialog */}
      <Dialog
        open={!!formatPicker}
        onOpenChange={(o) => !o && setFormatPicker(null)}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Choose Format</DialogTitle>
            <DialogDescription>
              {formatPicker?.type === "both"
                ? "Both files"
                : formatPicker?.type === "resume"
                  ? "Resume"
                  : "Cover Letter"}{" "}
              will be downloaded in the selected format.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => handleFormatPick("pdf")}
            >
              <FileText className="h-5 w-5" />
              PDF
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-primary border-primary/30 hover:bg-primary/10"
              onClick={() => handleFormatPick("docx")}
            >
              <FileText className="h-5 w-5" />
              DOCX
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm bg-foreground text-background animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}

      {/* Interview prep chat sidebar */}
      {chatApp && (
        <ApplicationChatSidebar
          appId={chatApp.id}
          jobTitle={chatApp.jobTitle}
          company={chatApp.company}
          onClose={() => setChatApp(null)}
        />
      )}
    </div>
  );
}
