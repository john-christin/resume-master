import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserRole } from "../auth";
import type { GenerateResponse } from "../types";

export default function Preview() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state as GenerateResponse | null;
  const [activeTab, setActiveTab] = useState<"resume" | "cover_letter">(
    "resume"
  );

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">No preview data available.</p>
        <button
          onClick={() => navigate("/generate")}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Generate New Application
        </button>
      </div>
    );
  }

  const { preview, resume_url, cover_letter_url, profile_name, job_title, company } = data;
  const safeName = (profile_name ?? "Resume").trim().replace(/\s+/g, "_");
  const withName = (url: string, label: string) => `${url}?name=${safeName}_${label}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {job_title}{company ? ` · ${company}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/generate")}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Generate Another
          </button>
          <button
            onClick={() => navigate("/history")}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            View History
          </button>
        </div>
      </div>

      {/* Cost info - admin only */}
      {getUserRole() === "admin" &&
        (data.prompt_tokens > 0 || data.completion_tokens > 0) && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
              Generation Cost
            </h2>
            <div className="flex flex-wrap gap-4 text-sm text-blue-700 dark:text-blue-400">
              <span>Prompt tokens: {data.prompt_tokens.toLocaleString()}</span>
              <span>
                Completion tokens: {data.completion_tokens.toLocaleString()}
              </span>
              <span className="font-medium">Cost: ${data.cost.toFixed(4)}</span>
            </div>
          </div>
        )}

      {/* Download buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Download Documents
        </h2>
        <div className="flex flex-wrap gap-2">
          <a
            href={withName(resume_url, "Resume.pdf")}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
          >
            Resume PDF
          </a>
          <a
            href={withName(resume_url.replace(".pdf", ".docx"), "Resume.docx")}
            className="px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-md text-sm hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
          >
            Resume DOCX
          </a>
          <a
            href={withName(cover_letter_url, "Cover_Letter.pdf")}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 transition-colors"
          >
            Cover Letter PDF
          </a>
          <a
            href={withName(cover_letter_url.replace(".pdf", ".docx"), "Cover_Letter.docx")}
            className="px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-md text-sm hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
          >
            Cover Letter DOCX
          </a>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab("resume")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "resume"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Resume Preview
          </button>
          <button
            onClick={() => setActiveTab("cover_letter")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "cover_letter"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Cover Letter Preview
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {activeTab === "resume" ? (
          <div className="space-y-6">
            {/* Summary */}
            {preview.summary && (
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide border-b border-gray-300 dark:border-gray-600 pb-1 mb-2">
                  Summary
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {preview.summary}
                </p>
              </div>
            )}

            {/* Technical Skills */}
            {preview.skills && preview.skills.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide border-b border-gray-300 dark:border-gray-600 pb-1 mb-2">
                  Technical Skills
                </h2>
                <div className="space-y-1">
                  {preview.skills.map((cat, index) => (
                    <p key={index} className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{cat.category}: </span>
                      {cat.skills.join(", ")}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Professional Experience */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide border-b border-gray-300 dark:border-gray-600 pb-1 mb-3">
                Professional Experience
              </h2>
              <div className="space-y-5">
                {preview.tailored_experiences.map((exp, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm">
                        {exp.company}
                        {exp.location && (
                          <span className="text-gray-600 dark:text-gray-400">, {exp.location}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <p className="text-sm italic text-gray-700 dark:text-gray-300">{exp.title}</p>
                      <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
                        {exp.start_date} - {exp.end_date || "Present"}
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {exp.bullets.map((bullet, bi) => (
                        <li
                          key={bi}
                          className="text-sm text-gray-700 dark:text-gray-300 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400 dark:before:text-gray-500"
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            {preview.cover_letter.split("\n\n").map((para, index) => (
              <p key={index} className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                {para}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
