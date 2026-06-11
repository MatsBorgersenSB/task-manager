import type { ReactNode } from "react";
import { ui } from "@/lib/ui/classes";

type FormFieldProps = {
  label: string;
  children: ReactNode;
};

export function FormField({ label, children }: FormFieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${ui.label}`}>
      {label}
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={ui.input.replace("mt-1 ", "")} {...props} />;
}

export const submitClass = `${ui.btnPrimary} w-full py-2.5`;

export function Divider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-surface px-2 text-muted">or</span>
      </div>
    </div>
  );
}
