import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfiles, createProfile, updateProfile } from "../api/profile";
import EducationForm from "../components/EducationForm";
import ExperienceForm from "../components/ExperienceForm";
import LoadingSpinner from "../components/LoadingSpinner";
import type { Education, Experience, ProfileCreate } from "../types";

const emptyProfile: ProfileCreate = {
  name: "",
  educations: [],
  experiences: [],
};

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileCreate>(emptyProfile);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExisting, setIsExisting] = useState(false);

  useEffect(() => {
    getProfiles()
      .then((res) => {
        const owned = res.data.find((p) => p.is_owner);
        if (owned) {
          setProfileId(owned.id);
          setProfile({
            name: owned.name,
            location: owned.location,
            phone: owned.phone,
            email: owned.email,
            linkedin: owned.linkedin,
            summary: owned.summary,
            educations: owned.educations,
            experiences: owned.experiences,
          });
          setIsExisting(
            owned.educations.length > 0 || owned.experiences.length > 0
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (profileId) {
        await updateProfile(profileId, profile);
      } else {
        await createProfile(profile);
      }
      navigate("/generate");
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isExisting ? "Edit Your Profile" : "Set Up Your Profile"}
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile.email || ""}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={profile.phone || ""}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={profile.linkedin || ""}
                onChange={(e) =>
                  setProfile({ ...profile, linkedin: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Professional Summary
            </label>
            <textarea
              value={profile.summary || ""}
              onChange={(e) =>
                setProfile({ ...profile, summary: e.target.value })
              }
              rows={3}
              placeholder="Brief professional summary..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <EducationForm
            educations={profile.educations}
            onChange={(educations: Education[]) =>
              setProfile({ ...profile, educations })
            }
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <ExperienceForm
            experiences={profile.experiences}
            onChange={(experiences: Experience[]) =>
              setProfile({ ...profile, experiences })
            }
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
