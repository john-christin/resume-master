import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createProfile, getProfile, updateProfile } from "../api/profile";
import { getUserRole } from "../auth";
import EducationForm from "../components/EducationForm";
import ExperienceForm from "../components/ExperienceForm";
import LoadingSpinner from "../components/LoadingSpinner";
import type { Education, Experience, ProfileCreate } from "../types";

const emptyProfile: ProfileCreate = {
  name: "",
  location: "",
  phone: "",
  email: "",
  linkedin: "",
  summary: "",
  educations: [],
  experiences: [],
};

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { profileId } = useParams<{ profileId: string }>();
  const isNew = !profileId;

  const [profile, setProfile] = useState<ProfileCreate>(emptyProfile);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    getProfile(profileId)
      .then((res) => {
        const p = res.data;
        setProfile({
          name: p.name,
          location: p.location || "",
          phone: p.phone || "",
          email: p.email || "",
          linkedin: p.linkedin || "",
          summary: p.summary || "",
          educations: p.educations,
          experiences: p.experiences,
        });
        setReadOnly(p.is_shared && !p.is_owner && getUserRole() !== "admin");
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [profileId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(null);

    try {
      if (isNew) {
        await createProfile(profile);
      } else {
        await updateProfile(profileId!, profile);
      }
      navigate("/profiles");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading profile..." />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {readOnly
          ? "View Profile (Read Only)"
          : isNew
            ? "Create New Profile"
            : "Edit Profile"}
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                required
                readOnly={readOnly}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location (City, State)
              </label>
              <input
                type="text"
                value={profile.location || ""}
                onChange={(e) =>
                  setProfile({ ...profile, location: e.target.value })
                }
                placeholder="e.g., San Francisco, CA"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                readOnly={readOnly}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile.email || ""}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                readOnly={readOnly}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={profile.phone || ""}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                readOnly={readOnly}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={profile.linkedin || ""}
                onChange={(e) =>
                  setProfile({ ...profile, linkedin: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                readOnly={readOnly}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Professional Summary
            </label>
            <textarea
              value={profile.summary || ""}
              onChange={(e) =>
                setProfile({ ...profile, summary: e.target.value })
              }
              rows={3}
              placeholder="Brief professional summary..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              readOnly={readOnly}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <EducationForm
            educations={profile.educations}
            onChange={(educations: Education[]) =>
              setProfile({ ...profile, educations })
            }
            readOnly={readOnly}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ExperienceForm
            experiences={profile.experiences}
            onChange={(experiences: Experience[]) =>
              setProfile({ ...profile, experiences })
            }
            readOnly={readOnly}
          />
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => navigate("/profiles")}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Back to Profiles
          </button>
          {!readOnly && (
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : isNew ? "Create Profile" : "Save Changes"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
