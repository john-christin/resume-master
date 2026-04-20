import type { ApplicationSummary } from "../types";

interface Props {
  application: ApplicationSummary;
  onDelete: (id: string) => void;
}

export default function ApplicationCard({ application, onDelete }: Props) {
  const date = new Date(application.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const appId = application.id;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            {application.job_title}
          </h3>
          <p className="text-sm text-gray-600">{application.company}</p>
          <p className="text-xs text-gray-400 mt-1">{date}</p>
        </div>
        <button
          onClick={() => onDelete(application.id)}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Delete
        </button>
      </div>

      {application.job_url && (
        <a
          href={application.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
        >
          View Job Posting
        </a>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <a
          href={`/api/download/${appId}_resume.pdf`}
          className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs hover:bg-green-100"
        >
          Resume PDF
        </a>
        <a
          href={`/api/download/${appId}_resume.docx`}
          className="px-3 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded text-xs hover:bg-gray-100"
        >
          Resume DOCX
        </a>
        <a
          href={`/api/download/${appId}_cover_letter.pdf`}
          className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs hover:bg-purple-100"
        >
          Cover Letter PDF
        </a>
        <a
          href={`/api/download/${appId}_cover_letter.docx`}
          className="px-3 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded text-xs hover:bg-gray-100"
        >
          Cover Letter DOCX
        </a>
      </div>
    </div>
  );
}
