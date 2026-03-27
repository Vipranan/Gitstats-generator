export default function Loader() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-primary-600 dark:border-gray-700 dark:border-t-primary-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading data...
        </p>
      </div>
    </div>
  );
}
