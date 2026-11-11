import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform.toUpperCase().includes('MAC') || navigator.userAgent.toUpperCase().includes('MAC'));

/** ⌘ on a Mac, Ctrl elsewhere. */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

export const isModKey = (e: KeyboardEvent | ReactKeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey);

export interface ShortcutInfo {
  keys: string[];
  label: string;
  group: 'Work faster' | 'Jump to';
}

// Avoids keys macOS / Electron already use (⌘Q, ⌘W, ⌘H, ⌘M, ⌘R, ⌘0 and ⌘ +/-).
export const SHORTCUTS: ShortcutInfo[] = [
  { keys: [MOD_KEY, 'N'], label: 'New invoice / voucher / return', group: 'Work faster' },
  { keys: [MOD_KEY, 'Enter'], label: 'Save the open form', group: 'Work faster' },
  { keys: [MOD_KEY, 'K'], label: 'Search the list on screen', group: 'Work faster' },
  { keys: ['Esc'], label: 'Close the open window', group: 'Work faster' },
  { keys: [MOD_KEY, '/'], label: 'Show these shortcuts', group: 'Work faster' },
  { keys: [MOD_KEY, '1'], label: 'Sale Invoices', group: 'Jump to' },
  { keys: [MOD_KEY, '2'], label: 'Customer Accounts', group: 'Jump to' },
  { keys: [MOD_KEY, '3'], label: 'Sale Returns', group: 'Jump to' },
  { keys: [MOD_KEY, '4'], label: 'Monthly Sales Report', group: 'Jump to' },
  { keys: [MOD_KEY, '5'], label: 'Sales Reports', group: 'Jump to' },
  { keys: [MOD_KEY, '6'], label: 'Purchases', group: 'Jump to' },
  { keys: [MOD_KEY, '7'], label: 'Products', group: 'Jump to' },
  { keys: [MOD_KEY, '8'], label: 'Inventory Reports', group: 'Jump to' },
  { keys: [MOD_KEY, ','], label: 'Settings', group: 'Jump to' },
];

// ─── "New entry" (⌘N) ───────────────────────────────────────────────────────
// Screens that can create something listen for this. If ⌘N is pressed on another
// screen, the app switches to Sale Invoices and the request is picked up on mount.
const NEW_ENTRY_EVENT = 'axiom:new-entry';
let pendingNewEntry = false;

export function requestNewEntry(screenIsOpen: boolean) {
  if (screenIsOpen) window.dispatchEvent(new Event(NEW_ENTRY_EVENT));
  else pendingNewEntry = true;
}

export function useNewEntryShortcut(open: () => void) {
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  useEffect(() => {
    if (pendingNewEntry) {
      pendingNewEntry = false;
      openRef.current();
    }
    const handler = () => openRef.current();
    window.addEventListener(NEW_ENTRY_EVENT, handler);
    return () => window.removeEventListener(NEW_ENTRY_EVENT, handler);
  }, []);
}

/** Submit the form the cursor is in, or else the form in the top-most open window. */
export function submitActiveForm(): boolean {
  const active = document.activeElement as HTMLElement | null;
  let form = active?.closest('form') ?? null;
  if (!form) {
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>('.fixed form'));
    form = forms[forms.length - 1] ?? null;
  }
  if (!form) return false;
  form.requestSubmit();
  return true;
}
