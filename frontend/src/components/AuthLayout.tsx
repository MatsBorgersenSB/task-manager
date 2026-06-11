import type { ReactNode } from "react";
import BrandLogo from "@/components/BrandLogo";
import { ui } from "@/lib/ui/classes";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shared shell for login and signup pages. */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className={`flex min-h-screen flex-col ${ui.page}`}>
      <div className="bg-primary px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-md justify-center">
          <BrandLogo variant="light" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>

          <div className={`p-8 ${ui.card}`}>{children}</div>

          {footer ? (
            <div className="mt-6 text-center text-sm text-muted">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
