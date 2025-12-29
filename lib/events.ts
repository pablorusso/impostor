
import { pusher } from './pusher';

export type GameEventType =
  | 'init'
  | 'player-join'
  | 'player-leave'
  | 'round-start'
  | 'round-end'
  | 'round-next'
  | 'next-turn'
  | 'impostor-found'
  | 'game-close';

export interface GameEvent {
  type: GameEventType;
  code: string;
  timestamp: number;
  playerId?: string;
  roundId?: string;
  allFound?: boolean;
}

/**
 * Emits an event to a game channel using Pusher.
 * This notifies all subscribed clients that the game state has changed.
 *
 * @param code The game code, used to identify the Pusher channel.
 * @param type The type of event, sent as part of the payload.
 * @param extra Additional data to include in the event payload.
 */
export async function emit(code: string, type: GameEventType, extra?: Partial<Omit<GameEvent, 'code' | 'type' | 'timestamp'>>): Promise<void> {
  const channelName = `private-game-${code.toUpperCase()}`;
  const eventName = 'game-update';

  const payload = {
    type,
    code,
    timestamp: Date.now(),
    ...extra,
  };

  try {
    await pusher.trigger(channelName, eventName, payload);
    console.log(`[Pusher] Emitted event '${eventName}' on channel '${channelName}' for type '${type}'`);
  } catch (error) {
    console.error(`[Pusher] Error emitting event on channel '${channelName}':`, error);
  }
}

