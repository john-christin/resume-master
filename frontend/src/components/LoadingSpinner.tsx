export default function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4" />
      <p className="text-gray-600 dark:text-gray-400 text-sm">{message}</p>
    </div>
  );
}
