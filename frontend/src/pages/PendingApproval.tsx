import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";

export default function PendingApproval() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
        <div className="text-4xl mb-4">&#9202;</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Awaiting Approval
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your account is pending admin approval. You will be able to access the
          application once an administrator reviews and approves your account.
        </p>
        <button
          onClick={() => {
            clearAuth();
            navigate("/login");
          }}
          className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
