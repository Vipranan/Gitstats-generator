import { Inbox } from "lucide-react";

export default function EmptyState({ message = "No data available" }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500">
      <Inbox size={36} strokeWidth={1.5} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
