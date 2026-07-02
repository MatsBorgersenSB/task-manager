/** Shared Tailwind class strings — Planner Premium design system */

export const ui = {
  /* ── Page layout ─────────────────────────────────────────────────── */
  page: "min-h-screen overflow-visible bg-background text-primary",
  container: "mx-auto px-4 py-6 sm:px-6",
  workspaceStack: "flex flex-col gap-4",
  workspaceStackCompact: "flex flex-col gap-0",
  compactBar:
    "flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 sm:px-2.5",
  compactBarBordered:
    "flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/50 px-2 py-1 sm:px-2.5",

  /* ── Typography scale ────────────────────────────────────────────── */
  textDisplay: "text-[1.375rem] font-semibold leading-tight text-primary",
  textTitle: "text-lg font-semibold leading-snug text-primary",
  textSubtitle: "text-[0.9375rem] font-semibold leading-snug text-primary",
  textBody: "text-sm leading-normal text-primary",
  textCaption: "text-[0.8125rem] leading-normal text-primary/80",
  textMicro: "text-xs leading-normal text-muted",
  textMetadata: "text-[0.6875rem] leading-normal text-muted",

  /* ── Cards & zones ───────────────────────────────────────────────── */
  card: "rounded-[10px] border border-border/80 bg-surface shadow-card",
  cardSection: "rounded-[10px] border border-border/80 bg-surface p-5 shadow-card sm:p-6",
  cardHeader: "border-b border-border/60 px-5 py-3.5 sm:px-6",
  zone: "rounded-[10px] border border-border/70 bg-surface shadow-sm",
  zoneHeader:
    "flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-5",
  zoneBody: "px-4 py-3 sm:px-5 sm:py-4",
  zoneLabel: "text-[0.6875rem] font-medium text-muted",
  toolbarGroupLabel:
    "shrink-0 text-[0.6875rem] font-medium text-muted after:content-[':']",

  sectionTitle: "text-[0.9375rem] font-semibold text-primary",
  sectionSubtitle: "mt-0.5 text-sm text-muted",
  panelSectionTitle: "text-[0.875rem] font-semibold leading-snug text-primary",
  label: "block text-sm font-medium text-primary/85",

  /* ── Form controls ───────────────────────────────────────────────── */
  input:
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary shadow-sm transition placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
  textarea: "min-h-[5rem]",

  /* ── Buttons — primary / secondary / utility ───────────────────────── */
  btnPrimary:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
  btnPrimarySm:
    "inline-flex items-center justify-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-50",
  btnSecondary:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-primary shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/8 disabled:opacity-50",
  btnSecondarySm:
    "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-primary shadow-sm transition hover:bg-slate-50 disabled:opacity-50",
  btnUtility:
    "inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-slate-100 hover:text-primary disabled:opacity-50",
  btnUtilitySm:
    "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:bg-slate-100 hover:text-primary disabled:opacity-50",
  btnHeader:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50",
  btnHeaderPrimary:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50",
  btnPrimaryLg:
    "inline-flex items-center justify-center gap-2 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/25 disabled:cursor-not-allowed disabled:opacity-50",
  btnDanger:
    "inline-flex items-center justify-center rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-red-500",
  btnDangerLg:
    "inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25 disabled:cursor-not-allowed disabled:opacity-50",
  btnGhost:
    "inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-border/80 px-3 py-1.5 text-sm font-medium text-muted transition hover:border-primary/15 hover:bg-slate-50 hover:text-primary",

  /* ── Segmented control (view switcher) ───────────────────────────── */
  segmentGroup:
    "inline-flex items-center gap-0.5 rounded-md border border-border/80 bg-slate-50/80 p-0.5",
  segmentBtn:
    "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-primary",
  segmentBtnActive:
    "rounded bg-white px-2.5 py-1 text-xs font-medium text-primary shadow-sm ring-1 ring-border/60",

  /* ── Navigation ──────────────────────────────────────────────────── */
  navCard:
    "rounded-[10px] border border-border/80 bg-surface p-5 shadow-card transition hover:border-accent/30 hover:shadow-md",

  /* ── Data table ──────────────────────────────────────────────────── */
  table: "w-full table-auto text-sm",
  tableScroll: "task-table-scroll w-full min-h-[12rem]",
  tableHead: "bg-[#0f2d3a] print:bg-white",
  tableHeadCell:
    "bg-[#0f2d3a] px-2.5 py-2 text-left align-middle text-xs font-medium text-white/90 print:static print:bg-white print:text-black print:shadow-none",
  tableRowTransition:
    "transition-[background-color,opacity] duration-100 ease-out",
  tableRow:
    "cursor-pointer border-b border-slate-100 last:border-b-0 odd:bg-surface even:bg-slate-50/40 hover:bg-slate-50",
  tableRowSelected:
    "cursor-pointer border-b border-slate-100 bg-accent/8 ring-1 ring-inset ring-accent/20 last:border-b-0 hover:bg-accent/12",
  tableCell: "px-2.5 py-2 text-[0.8125rem] leading-snug text-primary/90 print:text-black",
  tableCellWrap: "w-full min-w-0 whitespace-normal break-words",
  tableTextPreview:
    "fixed z-[1000] max-w-[min(480px,90vw)] rounded-lg border border-gray-300 bg-white p-4 text-sm leading-relaxed text-gray-900 shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-[opacity,transform] duration-150 ease-out",
  tableTextPreviewVisible: "opacity-100 translate-y-0",
  tableTextPreviewHidden: "pointer-events-none opacity-0 translate-y-1",

  /* ── Alerts ──────────────────────────────────────────────────────── */
  alertError:
    "rounded-lg border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-800",
  alertSuccess:
    "rounded-lg border border-accent/25 bg-accent/8 px-4 py-3 text-sm text-primary",

  /* ── Filters & toolbar ───────────────────────────────────────────── */
  filterToggle:
    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-primary/80 transition hover:bg-slate-100",
  filterToolbarInput:
    "h-9 w-64 min-w-[12rem] rounded-md border border-border bg-surface px-3 pr-9 text-sm text-primary shadow-sm transition placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
  filterToolbarSelect:
    "h-8 min-w-[7.5rem] rounded-md border border-border bg-surface px-2.5 text-sm text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
  filterToolbarSelectSm:
    "h-8 w-44 min-w-[9rem] max-w-[14rem] rounded-md border border-border bg-surface px-2 text-sm text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
  inputCompact:
    "h-8 w-40 min-w-[8rem] max-w-[11rem] rounded-md border border-border bg-surface px-2.5 text-sm text-primary shadow-sm transition placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
  filterToolbarClear:
    "h-9 shrink-0 rounded-md px-3 text-sm font-medium text-muted transition hover:bg-slate-100 hover:text-primary",

  /* ── Pills & badges ──────────────────────────────────────────────── */
  ownerPill:
    "cursor-pointer rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 transition hover:bg-sky-100",
  ownerPillActive:
    "cursor-pointer rounded-full bg-accent/12 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-accent/25 transition hover:bg-accent/18",
  linkPill:
    "inline-flex max-w-[8rem] items-center gap-1 truncate rounded-md border border-border/70 bg-surface px-2 py-0.5 text-xs text-primary transition hover:border-accent/30 hover:bg-accent/5",
  linkPillAdd:
    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs font-medium text-muted transition hover:border-accent/30 hover:bg-accent/5 hover:text-primary",

  /* ── KPI stat card ───────────────────────────────────────────────── */
  kpiCard:
    "flex min-w-[5.5rem] flex-col gap-0.5 rounded-lg border border-transparent px-3 py-2 text-left transition hover:bg-slate-50",
  kpiCardActive: "border-border/80 bg-slate-50 shadow-sm",
  kpiLabel: "text-xs font-medium text-muted",
  kpiValue: "text-lg font-semibold tabular-nums leading-none",
  kpiInline:
    "inline-flex min-w-[4.25rem] items-baseline justify-center gap-1 rounded px-1.5 py-0.5 text-sm transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-60 sm:min-w-0",
  kpiInlineActive: "bg-slate-100 font-medium ring-1 ring-border/60",
  kpiInlineSep: "text-muted/40 select-none",
} as const;
