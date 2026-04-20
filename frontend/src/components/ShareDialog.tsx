import { useEffect, useState } from "react";
import {
  getProfileShares,
  searchUsers,
  shareProfile,
  unshareProfile,
} from "../api/profile";
import type { ProfileShareUser, UserSearchResult } from "../types";

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
          // Filter out already shared users
          const sharedIds = new Set(shares.map((s) => s.user_id));
          setSearchResults(
            res.data.filter((u) => !sharedIds.has(u.id))
          );
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, shares]);

  const handleShare = async (userId: string) => {
    try {
      await shareProfile(profileId, [userId]);
      // Refresh shares
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Share Profile
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
          />
          {searchResults.length > 0 && (
            <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded-md max-h-40 overflow-y-auto bg-white dark:bg-gray-700">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleShare(user.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-600 last:border-0 dark:text-gray-200"
                >
                  {user.username}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Shared with ({shares.length})
          </h3>
          {shares.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Not shared with anyone yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {shares.map((share) => (
                <div
                  key={share.user_id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{share.username}</span>
                  <button
                    onClick={() => handleUnshare(share.user_id)}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
