import { discussionsService } from '../modules/discussions/discussions.service';

/** How often to check for due scheduled messages. */
const TICK_MS = 30_000;

let ticking = false;

/**
 * Start the scheduled-message dispatcher. Every tick it posts any messages
 * whose time has come (rows are claimed atomically, so running multiple
 * instances is safe). Overlap-guarded, and errors never stop the loop.
 */
export function startScheduler(): void {
  setInterval(() => {
    if (ticking) return;
    ticking = true;
    void discussionsService
      .dispatchDueScheduledMessages()
      .catch((err) => console.error('[scheduler] dispatch error:', err))
      .finally(() => {
        ticking = false;
      });
  }, TICK_MS);
}
