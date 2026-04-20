import type { Education } from "../types";

interface Props {
  educations: Education[];
  onChange: (educations: Education[]) => void;
  readOnly?: boolean;
}

const emptyEducation: Education = {
  school: "",
  degree: "",
  field: "",
  gpa: "",
  start_date: "",
  end_date: "",
};

export default function EducationForm({ educations, onChange, readOnly }: Props) {
  const add = () => onChange([...educations, { ...emptyEducation }]);

  const remove = (index: number) =>
    onChange(educations.filter((_, i) => i !== index));

  const update = (index: number, field: keyof Education, value: string) => {
    const updated = educations.map((edu, i) =>
      i === index ? { ...edu, [field]: value } : edu
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Education</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={add}
            className="text-sm px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            + Add Education
          </button>
        )}
      </div>

      {educations.map((edu, index) => (
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
              placeholder="School"
              value={edu.school}
              onChange={(e) => update(index, "school", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            />
            <input
              type="text"
              placeholder="Degree (e.g., Bachelor of Science)"
              value={edu.degree}
              onChange={(e) => update(index, "degree", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            />
            <input
              type="text"
              placeholder="Field of Study"
              value={edu.field}
              onChange={(e) => update(index, "field", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            />
            <input
              type="text"
              placeholder="GPA (optional)"
              value={edu.gpa || ""}
              onChange={(e) => update(index, "gpa", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="Start Date (YYYY-MM)"
              value={edu.start_date}
              onChange={(e) => update(index, "start_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            />
            <input
              type="text"
              placeholder="End Date (YYYY-MM or leave empty)"
              value={edu.end_date || ""}
              onChange={(e) => update(index, "end_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      ))}

      {educations.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          No education entries yet. Click "+ Add Education" to add one.
        </p>
      )}
    </div>
  );
}
