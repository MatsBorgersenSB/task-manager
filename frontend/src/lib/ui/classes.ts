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
  btnDanger:
    "rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500",
  btnDangerLg:
    "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:opacity-50",
  btnGhost:
    "rounded-lg border border-dashed border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-primary/20 hover:bg-surface hover:text-primary",
  navCard:
    "rounded-lg border border-border bg-surface p-5 shadow-card transition hover:border-accent/40 hover:shadow-md",
  table: "table-auto min-w-max w-full divide-y divide-border text-sm",
  tableHead: "bg-primary",
  tableHeadCell:
    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-primary-foreground print:bg-white print:text-black",
  tableRow:
    "cursor-pointer transition-colors odd:bg-surface even:bg-background/80 hover:bg-accent/10",
  tableRowSelected:
    "cursor-pointer bg-accent/10 ring-1 ring-inset ring-accent/25 transition-colors hover:bg-accent/15",
  tableCell: "px-3 py-2 align-top text-primary/90 print:text-black",
  /** Inner wrapper for long text cells — max-width on <td> alone does not wrap in table-auto. */
  tableCellWrap: "w-full min-w-0 whitespace-normal break-words",
  alertError: "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
  alertSuccess: "rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-primary",
} as const;
