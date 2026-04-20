import type { Experience } from "../types";

interface Props {
  experiences: Experience[];
  onChange: (experiences: Experience[]) => void;
  readOnly?: boolean;
}

const emptyExperience: Experience = {
  company: "",
  location: "",
  title: "",
  description: "",
  start_date: "",
  end_date: "",
};

export default function ExperienceForm({ experiences, onChange, readOnly }: Props) {
  const add = () => onChange([...experiences, { ...emptyExperience }]);

  const remove = (index: number) =>
    onChange(experiences.filter((_, i) => i !== index));

  const update = (index: number, field: keyof Experience, value: string) => {
    const updated = experiences.map((exp, i) =>
      i === index ? { ...exp, [field]: value } : exp
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Experience</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={add}
            className="text-sm px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            + Add Experience
          </button>
        )}
      </div>

      {experiences.map((exp, index) => (
        <div
          key={index}
          className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-700/50"
        >
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              #{index + 1}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Company"
              value={exp.company}
              onChange={(e) => update(index, "company", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            />
            <input
              type="text"
              placeholder="Location (e.g., New York, NY)"
              value={exp.location || ""}
              onChange={(e) => update(index, "location", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="Job Title"
              value={exp.title}
              onChange={(e) => update(index, "title", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            />
            <input
              type="text"
              placeholder="Start Date (YYYY-MM)"
              value={exp.start_date}
              onChange={(e) => update(index, "start_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            />
            <input
              type="text"
              placeholder="End Date (YYYY-MM or leave empty for Present)"
              value={exp.end_date || ""}
              onChange={(e) => update(index, "end_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>

          <textarea
            placeholder="Description (one bullet point per line)&#10;- Built microservices handling 10K req/sec&#10;- Led migration to event-driven architecture"
            value={exp.description}
            onChange={(e) => update(index, "description", e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
      ))}

      {experiences.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          No experience entries yet. Click "+ Add Experience" to add one.
        </p>
      )}
    </div>
  );
}
