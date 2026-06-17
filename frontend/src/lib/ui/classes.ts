/** Shared Tailwind class strings — Standard Bio design system */

export const ui = {
  page: "min-h-screen bg-background text-primary",
  container: "mx-auto px-4 py-8 sm:px-6",
  card: "rounded-lg border border-border bg-surface shadow-card",
  cardSection: "rounded-lg border border-border bg-surface p-6 shadow-card",
  cardHeader: "border-b border-border px-6 py-4",
  sectionTitle: "text-lg font-semibold text-primary",
  sectionSubtitle: "mt-1 text-sm text-muted",
  label: "block text-sm font-medium text-primary/80",
  input:
    "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
  textarea: "min-h-[5rem]",
  btnPrimary:
    "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50",
  btnPrimarySm:
    "rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-50",
  btnSecondary:
    "rounded-lg border border-primary/15 bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-50",
  btnSecondarySm:
    "rounded-lg border border-primary/15 bg-surface px-3 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/5 disabled:opacity-50",
  btnHeader:
    "rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50",
  btnHeaderPrimary:
    "rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400/40 disabled:cursor-not-allowed disabled:opacity-50",
  btnDanger:
    "rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500",
  btnDangerLg:
    "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:opacity-50",
  btnGhost:
    "rounded-lg border border-dashed border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-primary/20 hover:bg-surface hover:text-primary",
  navCard:
    "rounded-lg border border-border bg-surface p-5 shadow-card transition hover:border-accent/40 hover:shadow-md",
  table: "w-full table-auto text-sm",
  tableScroll:
    "w-full max-h-[calc(100vh-14rem)] overflow-y-auto overflow-x-auto",
  tableHead: "bg-primary print:bg-white",
  tableHeadCell:
    "sticky top-0 z-20 bg-primary px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)] print:static print:bg-white print:text-black print:shadow-none",
  tableRowTransition: "transition-[background-color,opacity] duration-[120ms] ease-[ease]",
  tableRow:
    "cursor-pointer border-b border-slate-200 last:border-b-0 odd:bg-surface even:bg-background/80 hover:bg-slate-50",
  tableRowSelected:
    "cursor-pointer border-b border-slate-200 bg-accent/10 ring-1 ring-inset ring-accent/25 last:border-b-0 hover:bg-accent/15",
  tableCell: "px-4 py-2.5 text-primary/90 print:text-black",
  /** Inner wrapper for long text cells — max-width on <td> alone does not wrap in table-auto. */
  tableCellWrap: "w-full min-w-0 whitespace-normal break-words",
  alertError: "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
  alertSuccess: "rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-primary",
  filterToggle:
    "flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-primary transition hover:bg-background",
  filterToolbarInput:
    "h-9 w-64 min-w-[12rem] rounded-md border border-border bg-surface px-3 pr-9 text-sm text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
  filterToolbarSelect:
    "h-9 min-w-[7.5rem] rounded-md border border-border bg-surface px-2 text-sm text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
  filterToolbarClear:
    "ml-auto h-9 shrink-0 rounded-md border border-border px-3 text-sm text-primary transition hover:bg-background",
  filterToolbarSticky:
    "no-print sticky top-14 z-40 -mx-6 mb-3 border-b border-border bg-white/90 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/90",
  ownerPill:
    "cursor-pointer rounded-full bg-sky-100 px-2 py-0.5 text-xs text-primary transition hover:bg-sky-200",
  ownerPillActive:
    "cursor-pointer rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-accent/30 transition hover:bg-accent/25",
} as const;
