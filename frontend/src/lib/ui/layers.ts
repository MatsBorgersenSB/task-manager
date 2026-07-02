/**
 * Application-wide z-index layering.
 *
 * Stack (low → high):
 * sticky chrome → dropdowns → drawer → modal → modal dropdowns → toasts
 */
export const uiLayers = {
  stickyHeader: "z-20",
  dropdown: "z-[200]",
  contextMenuBackdrop: "z-[300]",
  contextMenu: "z-[310]",
  chatPanel: "z-[400]",
  drawer: "z-[1000]",
  modal: "z-[1200]",
  modalDropdown: "z-[1210]",
  toast: "z-[1300]",
} as const;
