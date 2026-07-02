import { userInitials } from "@/lib/tasks/userAttribution";

type UserAvatarProps = {
  name: string;
  email?: string | null;
  size?: "sm" | "md";
  className?: string;
};

const sizeClasses = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
} as const;

export default function UserAvatar({
  name,
  email,
  size = "sm",
  className = "",
}: UserAvatarProps) {
  const initials = userInitials(name, email);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold uppercase text-slate-700 ${sizeClasses[size]} ${className}`}
      aria-hidden
      title={name}
    >
      {initials}
    </span>
  );
}
