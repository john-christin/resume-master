import { AlertCircle, ChevronLeft, ChevronRight, Loader2, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { getLogCount, getLogs } from "../../api/admin";
import type { SystemLogItem } from "../../api/admin";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

const PAGE_SIZE = 100;

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [level, setLevel] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchLogs = async (off = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        level: level || undefined,
        category: category || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        limit: PAGE_SIZE,
        offset: off,
      };
      const [logsRes, countRes] = await Promise.all([getLogs(params), getLogCount(params)]);
      setLogs(logsRes.data);
      setTotal(countRes.data.count);
      setOffset(off);
    } catch {
      setError("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const levelVariant = (l: string) =>
    l === "CRITICAL" || l === "ERROR" ? "destructive" : l === "WARNING" ? "warning" : "secondary";

  const catColor = (c: string) =>
    c === "generation"
      ? "text-blue-600 dark:text-blue-400"
      : c === "ai_call"
        ? "text-violet-600 dark:text-violet-400"
        : c === "auth"
          ? "text-emerald-600 dark:text-emerald-400"
          : c === "admin"
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground";

  const rowBg = (l: string) =>
    l === "CRITICAL"
      ? "bg-red-50/80 dark:bg-red-900/20"
      : l === "ERROR"
        ? "bg-red-50/40 dark:bg-red-900/10"
        : l === "WARNING"
          ? "bg-amber-50/60 dark:bg-amber-900/10"
          : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none">System Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Monitor application activity and errors</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          value={level || "all"}
          onValueChange={(v) => setLevel(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="WARNING">WARNING</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
            <SelectItem value="CRITICAL">CRITICAL</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={category || "all"}
          onValueChange={(v) => setCategory(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="api">API</SelectItem>
            <SelectItem value="ai_call">AI Call</SelectItem>
            <SelectItem value="generation">Generation</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 w-auto"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 w-auto"
          />
        </div>
        <Button onClick={() => fetchLogs(0)} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </>
          ) : (
            "Search"
          )}
        </Button>
        <span className="text-xs text-muted-foreground self-end pb-2">
          {total.toLocaleString()} total
        </span>
      </div>

      {/* Log table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="w-6 px-3 py-2" />
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Time</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Level</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Message</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">IP</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Endpoint</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">ms</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No logs found.
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const isExpanded = expanded.has(log.id);
                const hasDetail = !!(log.details || log.stack_trace || log.error_type);
                return (
                  <>
                    <tr
                      key={log.id}
                      className={`border-b ${rowBg(log.level)} ${hasDetail ? "cursor-pointer hover:brightness-95" : ""}`}
                      onClick={() => hasDetail && toggleExpand(log.id)}
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {hasDetail && (
                          <span className="text-[10px]">{isExpanded ? "▼" : "▶"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={levelVariant(log.level)}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {log.level}
                        </Badge>
                      </td>
                      <td className={`px-3 py-2 font-medium ${catColor(log.category)}`}>
                        {log.category}
                      </td>
                      <td className="px-3 py-2 max-w-sm truncate">{log.message}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono whitespace-nowrap">
                        {log.ip_address || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">
                        {log.endpoint || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {log.duration_ms ?? "—"}
                      </td>
                    </tr>
                    {isExpanded && hasDetail && (
                      <tr key={`${log.id}-detail`} className={`border-b ${rowBg(log.level)}`}>
                        <td colSpan={8} className="px-6 py-3 space-y-2">
                          {log.error_type && (
                            <p className="text-xs font-semibold text-destructive">
                              Exception: {log.error_type}
                            </p>
                          )}
                          {log.details &&
                            (() => {
                              try {
                                const parsed = JSON.parse(log.details);
                                return (
                                  <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                                    {JSON.stringify(parsed, null, 2)}
                                  </pre>
                                );
                              } catch {
                                return (
                                  <p className="text-xs text-muted-foreground">{log.details}</p>
                                );
                              }
                            })()}
                          {log.stack_trace && (
                            <pre className="text-xs text-destructive bg-destructive/5 rounded p-2 overflow-x-auto max-h-48">
                              {log.stack_trace}
                            </pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => fetchLogs(offset - PAGE_SIZE)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => fetchLogs(offset + PAGE_SIZE)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
