/** Shown next to tasks created by external (client) users. */
export default function ClientCreatedBadge() {
  return (
    <span className="inline-flex w-fit rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 print:border print:border-slate-400 print:bg-white print:text-black">
      Created by Client
    </span>
  );
}
