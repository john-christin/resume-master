import { UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getProfileShares,
  searchUsers,
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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

interface Props {
  profileId: string;
  onClose: () => void;
}

export default function ShareDialog({ profileId, onClose }: Props) {
  const [shares, setShares] = useState<ProfileShareUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfileShares(profileId)
      .then((res) => setShares(res.data))
      .catch(() => setError("Failed to load shares"));
  }, [profileId]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchUsers(searchQuery)
        .then((res) => {
          const sharedIds = new Set(shares.map((s) => s.user_id));
          setSearchResults(res.data.filter((u) => !sharedIds.has(u.id)));
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, shares]);

  const handleShare = async (userId: string) => {
    try {
      await shareProfile(profileId, [userId]);
      const res = await getProfileShares(profileId);
      setShares(res.data);
      setSearchQuery("");
      setSearchResults([]);
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
            Search for users to share this profile with.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="share-search">Search users</Label>
          <div className="relative">
            <Input
              id="share-search"
              placeholder="Type username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full z-10 rounded-md border bg-popover shadow-md overflow-hidden">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleShare(user.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 border-b last:border-0 border-border"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {user.username}
                  </button>
                ))}
              </div>
            )}
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
