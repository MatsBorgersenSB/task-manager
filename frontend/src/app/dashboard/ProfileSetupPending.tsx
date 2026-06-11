import Link from "next/link";
import { ui } from "@/lib/ui/classes";

type ProfileSetupPendingProps = {
  email: string;
};

export default function ProfileSetupPending({ email }: ProfileSetupPendingProps) {
  return (
    <div className={`flex min-h-screen items-center justify-center px-4 ${ui.page}`}>
      <div className={`max-w-md p-8 text-center ${ui.card}`}>
        <h1 className={ui.sectionTitle}>Setting up your account</h1>
        <p className="mt-2 text-sm text-muted">
          We are creating your profile for{" "}
          <span className="font-medium text-primary">{email}</span>. This usually
          takes a moment.
        </p>
        <p className="mt-4 text-sm text-muted">
          If this screen persists, refresh the page or try signing in again.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className={ui.btnPrimary}>
            Refresh
          </Link>
          <Link href="/login" className={ui.btnSecondary}>
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
