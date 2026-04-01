export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-red-400 text-sm">⚠</span>
        <span className="text-sm text-red-400">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded px-3 py-1 text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 dark:hover:bg-gray-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}
