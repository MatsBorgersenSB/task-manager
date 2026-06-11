type BrandLogoProps = {
  variant?: "light" | "dark";
  className?: string;
};

/** Placeholder logo aligned with Standard Bio branding */
export default function BrandLogo({
  variant = "light",
  className = "",
}: BrandLogoProps) {
  const textClass =
    variant === "light" ? "text-white" : "text-primary";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent shadow-sm"
        aria-hidden
      >
        <span className="text-sm font-bold text-white">SB</span>
      </div>
      <div className="leading-tight">
        <p className={`text-sm font-semibold tracking-wide ${textClass}`}>
          Standard Bio
        </p>
        <p
          className={`text-xs ${
            variant === "light" ? "text-white/70" : "text-muted"
          }`}
        >
          Task Manager
        </p>
      </div>
    </div>
  );
}
