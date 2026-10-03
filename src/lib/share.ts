import { toast } from '~/lib/events';

/**
 * Copy and share for app actions (audit AR2-15): Diagnose's results, the shopping list and the
 * map's calibration JSON. A copy says so in a toast; a share's feedback is the system sheet. Both
 * answer false when nothing left the page, so the caller can show the text to copy by hand.
 */
export async function copyText(text: string, done = 'Copied to the clipboard.'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return false;
  }
  toast('info', done);
  return true;
}

/** Whether the browser has a system share sheet. False during SSR. */
export const canShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * The system share sheet where there is one, else a copy. Cancelling the sheet is an answer, not
 * a failure; any other error falls back to the copy.
 */
export async function shareText(title: string, text: string): Promise<boolean> {
  if (canShare()) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return true;
    }
  }
  return copyText(text);
}
