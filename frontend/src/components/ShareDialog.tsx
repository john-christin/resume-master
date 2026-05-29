import { UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getProfileShares,
  listUsers,
  shareProfile,
  unshareProfile,
} from "../api/profile";
import type { ProfileShareUser, UserSearchResult } from "../types";
import { Alert, AlertDescription } from "./ui/alert";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";

interface Props {
  profileId: string;
  onClose: () => void;
}

export default function ShareDialog({ profileId, onClose }: Props) {
  const [shares, setShares] = useState<ProfileShareUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProfileShares(profileId), listUsers()])
      .then(([sharesRes, usersRes]) => {
        setShares(sharesRes.data);
        setAllUsers(usersRes.data);
      })
      .catch(() => setError("Failed to load data"));
  }, [profileId]);

  const availableUsers = allUsers.filter(
    (u) => !shares.some((s) => s.user_id === u.id)
  );

  const handleShare = async () => {
    if (!selectedUserId) return;
    try {
      await shareProfile(profileId, [selectedUserId]);
      const res = await getProfileShares(profileId);
      setShares(res.data);
      setSelectedUserId("");
    } catch {
      setError("Failed to share profile");
    }
  };

  const handleUnshare = async (userId: string) => {
    try {
      await unshareProfile(profileId, userId);
      setShares((prev) => prev.filter((s) => s.user_id !== userId));
    } catch {
      setError("Failed to remove share");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Share Profile
          </DialogTitle>
          <DialogDescription>
            Select a user to share this profile with.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label>Add user</Label>
          <div className="flex gap-2">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={availableUsers.length === 0}
            >
              <SelectTrigger className="flex-1">
                <SelectValue
                  placeholder={
                    availableUsers.length === 0
                      ? "No more users to add"
                      : "Select a user…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px]">
                          {u.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {u.username}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleShare} disabled={!selectedUserId}>
              Add
            </Button>
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-sm font-medium mb-3">
            Shared with{" "}
            <span className="text-muted-foreground">({shares.length})</span>
          </p>
          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Not shared with anyone yet.
            </p>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-1.5">
                {shares.map((share) => (
                  <div
                    key={share.user_id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {share.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {share.username}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleUnshare(share.user_id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
