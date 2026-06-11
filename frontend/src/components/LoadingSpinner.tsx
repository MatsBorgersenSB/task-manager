type LoadingSpinnerProps = {
  label?: string;
};

export default function LoadingSpinner({ label = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
        role="status"
        aria-label={label}
      />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
