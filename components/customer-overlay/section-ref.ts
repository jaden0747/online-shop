export interface SectionRef {
  /** Called on Escape. Returns true if it consumed the event (had an open form). */
  closeOpenForm: () => boolean;
  /** Reset all local editing state (called when overlay opens fresh). */
  reset: () => void;
}
