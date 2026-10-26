"use client";

import TodayView from "@/components/attention/TodayView";
import AppShell from "@/components/AppShell";
import { type UserRole } from "@/lib/roles";

type TodayClientProps = {
  email: string;
  role: UserRole;
  isAdmin: boolean;
};

export default function TodayClient({ email, role }: TodayClientProps) {
  return (
    <AppShell
      pageTitle="Today"
      pageDescription="Attention Center & personal workspace"
      userEmail={email}
      userRole={role}
      fullWidth
    >
      <TodayView userEmail={email} />
    </AppShell>
  );
}
