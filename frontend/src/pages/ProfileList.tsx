import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteProfile, getProfiles } from "../api/profile";
import { getUserRole } from "../auth";
import LoadingSpinner from "../components/LoadingSpinner";
import ShareDialog from "../components/ShareDialog";
import type { Profile } from "../types";

export default function ProfileList() {
  const navigate = useNavigate();
  const role = getUserRole();
  const isAdmin = role === "admin";
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharingProfileId, setSharingProfileId] = useState<string | null>(null);

  useEffect(() => {
    getProfiles()
      .then((res) => setProfiles(res.data))
      .catch(() => setError("Failed to load profiles"))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (profileId: string) => {
    if (!window.confirm("Are you sure you want to delete this profile?"))
      return;
    try {
      await deleteProfile(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } catch {
      setError("Failed to delete profile");
    }
  };

  if (loading) return <LoadingSpinner message="Loading profiles..." />;

  const ownProfiles = profiles.filter((p) => p.is_owner);
  const sharedProfiles = profiles.filter((p) => p.is_shared && !p.is_owner);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profiles</h1>
        <button
          onClick={() => navigate("/profiles/new")}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Create New Profile
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {ownProfiles.length === 0 && sharedProfiles.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No profiles yet.</p>
          <button
            onClick={() => navigate("/profiles/new")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Create Your First Profile
          </button>
        </div>
      ) : (
        <>
          {ownProfiles.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                My Profiles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ownProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {profile.name}
                      </h3>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 space-y-1">
                      {profile.email && <p>{profile.email}</p>}
                      <p>
                        {profile.educations.length} education(s),{" "}
                        {profile.experiences.length} experience(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => navigate(`/profiles/${profile.id}`)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          navigate("/generate", {
                            state: { profileId: profile.id },
                          })
                        }
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        Generate
                      </button>
                      <button
                        onClick={() => setSharingProfileId(profile.id)}
                        className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50"
                      >
                        Share
                      </button>
                      <button
                        onClick={() => handleDelete(profile.id)}
                        className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sharedProfiles.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {isAdmin ? "Other Users' Profiles" : "Shared With Me"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sharedProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800 p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {profile.name}
                      </h3>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
                        {profile.owner_username}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 space-y-1">
                      {profile.email && <p>{profile.email}</p>}
                      <p>
                        {profile.educations.length} education(s),{" "}
                        {profile.experiences.length} experience(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => navigate(`/profiles/${profile.id}`)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        {isAdmin ? "Edit" : "View"}
                      </button>
                      <button
                        onClick={() =>
                          navigate("/generate", {
                            state: { profileId: profile.id },
                          })
                        }
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        Generate
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setSharingProfileId(profile.id)}
                            className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50"
                          >
                            Share
                          </button>
                          <button
                            onClick={() => handleDelete(profile.id)}
                            className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sharingProfileId && (
        <ShareDialog
          profileId={sharingProfileId}
          onClose={() => setSharingProfileId(null)}
        />
      )}
    </div>
  );
}
