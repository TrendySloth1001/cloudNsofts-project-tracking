import { EventEmitter } from 'node:events';

/**
 * In-process pulse for channel activity. A long-poll (`wait_for_reply`) parks
 * on a channel and is woken the instant a message is posted or the conversation
 * is resolved on THIS instance — with a short poll interval as the cross-node
 * fallback (a pulse emitted on another instance won't cross the emitter).
 */
const emitter = new EventEmitter();
// Many concurrent waiters can park on the same channel; lift the leak warning.
emitter.setMaxListeners(0);

/** Wake every waiter currently parked on this channel. */
export function pulseChannel(channelId: string): void {
  emitter.emit(channelId);
}

/**
 * Resolve as soon as the channel pulses, or after `maxMs` — whichever comes
 * first. The caller re-checks the database on wake, so a spurious wake is
 * harmless and the timeout doubles as the cross-instance poll interval.
 */
export function waitForChannelPulse(
  channelId: string,
  maxMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      emitter.off(channelId, done);
      resolve();
    };
    const timer = setTimeout(done, maxMs);
    emitter.once(channelId, done);
  });
}
