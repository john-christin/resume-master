import { AlertCircle, Users } from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import { useEffect, useState } from "react";
import {
  approveUser,
  deleteUser,
  getUsers,
  rejectUser,
  suspendUser,
  unsuspendUser,
  updateUserRole,
} from "../../api/admin";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import type { UserListItem } from "../../types";
import { getUserId } from "../../auth";

function RoleBadge({ role }: { role: string }) {
  const variant =
    role === "admin" ? "purple" : role === "caller" ? "warning" : "default";
  return <Badge variant={variant}>{role}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "approved"
      ? "success"
      : status === "pending"
        ? "warning"
        : status === "suspended"
          ? "secondary"
          : "destructive";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roleSelections, setRoleSelections] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = getUserId();

  const fetchUsers = async (status?: string, search?: string) => {
    setLoading(true);
    try {
      const res = await getUsers(status || undefined, search || undefined);
      setUsers(res.data);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const userAction = async (userId: string, action: () => Promise<unknown>) => {
    setActionLoading(userId);
    try {
      await action();
      await fetchUsers(statusFilter, userSearch);
    } catch {
      setError("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    try {
      await updateUserRole(userId, newRole);
      await fetchUsers(statusFilter, userSearch);
    } catch {
      setError("Failed to update role");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = (userId: string, username: string) => {
    if (
      !window.confirm(
        `Permanently delete user "${username}" and all their data? This cannot be undone.`
      )
    )
      return;
    userAction(userId, () => deleteUser(userId));
  };

  if (loading && users.length === 0)
    return <LoadingSpinner message="Loading users..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage user accounts and permissions" />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by username…"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchUsers(statusFilter, userSearch)}
          className="w-56"
        />
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => {
            const val = v === "all" ? "" : v;
            setStatusFilter(val);
            fetchUsers(val, userSearch);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => fetchUsers(statusFilter, userSearch)}>
          Search
        </Button>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Profiles</TableHead>
                  <TableHead className="text-right">Apps</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isLoading = actionLoading === user.id;
                  return (
                    <TableRow key={user.id} className={isLoading ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        {user.username}
                        {isSelf && (
                          <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isSelf ||
                        (user.status !== "approved" && user.status !== "suspended") ? (
                          <RoleBadge role={user.role} />
                        ) : (
                          <Select
                            value={user.role}
                            disabled={isLoading}
                            onValueChange={(v) => handleChangeRole(user.id, v)}
                          >
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bidder">Bidder</SelectItem>
                              <SelectItem value="caller">Caller</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={user.status} />
                      </TableCell>
                      <TableCell className="text-right">{user.profile_count}</TableCell>
                      <TableCell className="text-right">{user.application_count}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {(user.status === "pending" || user.status === "rejected") && (
                              <>
                                <Select
                                  value={roleSelections[user.id] || "bidder"}
                                  onValueChange={(v) =>
                                    setRoleSelections((p) => ({ ...p, [user.id]: v }))
                                  }
                                >
                                  <SelectTrigger className="h-7 w-22 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="bidder">Bidder</SelectItem>
                                    <SelectItem value="caller">Caller</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="success"
                                  disabled={isLoading}
                                  onClick={() =>
                                    userAction(user.id, () =>
                                      approveUser(user.id, roleSelections[user.id] || "bidder")
                                    )
                                  }
                                >
                                  Approve
                                </Button>
                              </>
                            )}
                            {user.status === "pending" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isLoading}
                                onClick={() =>
                                  userAction(user.id, () => rejectUser(user.id))
                                }
                              >
                                Reject
                              </Button>
                            )}
                            {user.status === "approved" && (
                              <Button
                                size="sm"
                                variant="warning"
                                disabled={isLoading}
                                onClick={() =>
                                  userAction(user.id, () => suspendUser(user.id))
                                }
                              >
                                Suspend
                              </Button>
                            )}
                            {user.status === "suspended" && (
                              <Button
                                size="sm"
                                variant="success"
                                disabled={isLoading}
                                onClick={() =>
                                  userAction(user.id, () => unsuspendUser(user.id))
                                }
                              >
                                Unsuspend
                              </Button>
                            )}
                            {user.status !== "pending" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isLoading}
                                onClick={() => handleDeleteUser(user.id, user.username)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
