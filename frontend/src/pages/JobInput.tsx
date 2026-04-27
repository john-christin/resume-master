import axios from "axios";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { batchGenerate, generateApplication } from "../api/generate";
import { getProfiles } from "../api/profile";
import LoadingSpinner from "../components/LoadingSpinner";
import type { DuplicateInfo, JobDescriptionEntry, Profile } from "../types";

const emptyJob: JobDescriptionEntry = {
  job_title: "",
  company: "",
  job_url: "",
  job_description: "",
};

export default function JobInput() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedProfileId = (location.state as { profileId?: string })
    ?.profileId;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState(
    preselectedProfileId || ""
  );
  const [batchMode, setBatchMode] = useState(false);
  const [jobs, setJobs] = useState<JobDescriptionEntry[]>([{ ...emptyJob }]);
  const [loading, setLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workModeWarning, setWorkModeWarning] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);

  useEffect(() => {
    getProfiles(true)
      .then((res) => {
        setProfiles(res.data);
        if (!selectedProfileId && res.data.length > 0) {
          setSelectedProfileId(res.data[0].id);
        }
      })
      .catch(() => setError("Failed to load profiles"))
      .finally(() => setProfilesLoading(false));
  }, []);

  const updateJob = (
    index: number,
    field: keyof JobDescriptionEntry,
    value: string
  ) => {
    setJobs((prev) =>
      prev.map((j, i) => (i === index ? { ...j, [field]: value } : j))
    );
  };

const BATCH_LIMIT = 5;

  const addJob = () => {
    if (jobs.length >= BATCH_LIMIT) return;
    setJobs((prev) => [...prev, { ...emptyJob }]);
  };

  const removeJob = (index: number) =>
    setJobs((prev) => prev.filter((_, i) => i !== index));

  const detectWorkMode = (text: string): string | null => {
    const lower = text.toLowerCase();
    const hybridPatterns = [/\bhybrid\b/, /\bin[- ]office\s+\d/, /\d\s+days?\s+in[- ]office/, /\d\s+days?\s+on[- ]?site/];
    const onsitePatterns = [/\bon[- ]?site\b/, /\bin[- ]office\b/, /\bin[- ]person\b/, /\breturn to office\b/, /\bno remote\b/, /\bnot remote\b/, /\boffice[- ]based\b/, /\bwork from office\b/, /\bmust be located\b/, /\brelocation required\b/];
    for (const p of hybridPatterns) { if (p.test(lower)) return "hybrid"; }
    for (const p of onsitePatterns) { if (p.test(lower)) return "onsite"; }
    return null;
  };

  const doGenerate = async (skipDuplicateCheck = false) => {
    setLoading(true);
    setError(null);

    try {
      if (batchMode && jobs.length > 1) {
        const res = await batchGenerate({
          profile_id: selectedProfileId,
          jobs: jobs.map((j) => ({
            job_title: j.job_title,
            company: j.company || undefined,
            job_url: j.job_url || undefined,
            job_description: j.job_description,
            skip_duplicate_check: skipDuplicateCheck,
          })),
        });
        navigate("/history", {
          state: {
            batchResult: {
              count: res.data.results.length,
              totalCost: res.data.total_cost,
            },
          },
        });
      } else {
        const job = jobs[0];
        const res = await generateApplication({
          profile_id: selectedProfileId,
          job_title: job.job_title,
          company: job.company || undefined,
          job_url: job.job_url || undefined,
          job_description: job.job_description,
          skip_duplicate_check: skipDuplicateCheck,
        });
        navigate(`/preview/${res.data.application_id}`, {
          state: res.data,
        });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data?.detail as DuplicateInfo;
        if (data?.duplicate) {
          setDuplicateInfo(data);
          return;
        }
      }
      const message =
        err instanceof Error ? err.message : "Failed to generate application";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId) {
      setError("Please select a profile");
      return;
    }

    // Check for onsite/hybrid work mode
    const allDescriptions = jobs.map((j) => j.job_description).join(" ");
    const workMode = detectWorkMode(allDescriptions);
    if (workMode) {
      const label = workMode === "hybrid" ? "hybrid (partially in-office)" : "onsite (in-office)";
      setWorkModeWarning(label);
      return;
    }

    await doGenerate();
  };

  if (profilesLoading)
    return <LoadingSpinner message="Loading profiles..." />;

  if (loading) {
    return (
      <LoadingSpinner
        message={
          batchMode && jobs.length > 1
            ? `Generating ${jobs.length} applications... This may take a while.`
            : "Tailoring your resume and generating cover letter... This may take 10-15 seconds."
        }
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Generate Application
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            You need a profile before generating applications.
          </p>
          <button
            onClick={() => navigate("/profiles/new")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Create a Profile
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Profile *
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={batchMode}
                  onChange={(e) => {
                    setBatchMode(e.target.checked);
                    if (!e.target.checked && jobs.length > 1) {
                      setJobs([jobs[0]]);
                    }
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                Batch Mode
              </label>
            </div>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="" disabled>
                -- Choose a profile --
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_shared ? " (shared)" : ""}
                  {p.email ? ` - ${p.email}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Job descriptions */}
          {batchMode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Job Descriptions ({jobs.length})
                </h2>
                <div className="flex items-center gap-2">
                  {jobs.length >= BATCH_LIMIT && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Max {BATCH_LIMIT} applications per batch
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={addJob}
                    disabled={jobs.length >= BATCH_LIMIT}
                    className="text-sm px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Add Job
                  </button>
                </div>
              </div>

              {jobs.map((job, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Job #{index + 1}
                    </span>
                    {jobs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeJob(index)}
                        className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Job Title *"
                        value={job.job_title}
                        onChange={(e) =>
                          updateJob(index, "job_title", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Company (optional)"
                        value={job.company || ""}
                        onChange={(e) =>
                          updateJob(index, "company", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                      />
                      <input
                        type="url"
                        placeholder="Job URL (optional)"
                        value={job.job_url || ""}
                        onChange={(e) =>
                          updateJob(index, "job_url", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <textarea
                      placeholder="Paste the full job description here..."
                      value={job.job_description}
                      onChange={(e) =>
                        updateJob(index, "job_description", e.target.value)
                      }
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={jobs[0].job_title}
                    onChange={(e) =>
                      updateJob(0, "job_title", e.target.value)
                    }
                    placeholder="e.g., Senior Software Engineer"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company (optional)
                  </label>
                  <input
                    type="text"
                    value={jobs[0].company || ""}
                    onChange={(e) =>
                      updateJob(0, "company", e.target.value)
                    }
                    placeholder="e.g., Acme Corp"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Job URL (optional)
                </label>
                <input
                  type="url"
                  value={jobs[0].job_url || ""}
                  onChange={(e) =>
                    updateJob(0, "job_url", e.target.value)
                  }
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Job Description *
                </label>
                <textarea
                  value={jobs[0].job_description}
                  onChange={(e) =>
                    updateJob(0, "job_description", e.target.value)
                  }
                  rows={12}
                  placeholder="Paste the full job description here..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition-colors"
            >
              {batchMode && jobs.length > 1
                ? `Generate ${jobs.length} Applications`
                : "Generate Resume & Cover Letter"}
            </button>
          </div>
        </form>
      )}

      {/* Work mode warning modal */}
      {workModeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setWorkModeWarning(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Work Mode Warning
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  This job description appears to be <span className="font-medium text-yellow-700 dark:text-yellow-400">{workModeWarning}</span>. Are you sure you want to proceed with generating a resume for this position?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setWorkModeWarning(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setWorkModeWarning(null);
                  doGenerate();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 transition-colors"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate application modal */}
      {duplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDuplicateInfo(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Duplicate Application Detected
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  A similar application for this role has already been generated with the same profile.
                </p>
              </div>
            </div>

            <div className="mb-5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Previous Application
              </p>
              <div className="space-y-1 text-sm">
                <p className="text-gray-900 dark:text-white font-medium">
                  {duplicateInfo.existing_application.job_title}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {duplicateInfo.existing_application.company}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">
                  Generated on {new Date(duplicateInfo.existing_application.created_at).toLocaleDateString()} &middot; {Math.round(duplicateInfo.similarity * 100)}% match
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDuplicateInfo(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDuplicateInfo(null);
                  doGenerate(true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 transition-colors"
              >
                Generate Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
