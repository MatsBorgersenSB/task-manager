export default function ArchivedReadOnlyBanner() {
  return (
    <div
      className="no-print mb-3 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800"
      role="status"
    >
      <p className="font-semibold">This project is archived.</p>
      <p className="mt-1 text-xs text-slate-600">
        Read-only mode enabled — tasks, comments, and status changes are disabled.
      </p>
    </div>
  );
}
