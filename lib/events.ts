import { PlayerState, Round } from './types';
import { getState } from './store';

export type GameEventType =
  | 'init'
  | 'player-join'
  | 'round-start'
  | 'round-end'
  | 'round-next'
  | 'next-turn'
  | 'game-close';

type BroadcastState = Omit<
  PlayerState,
  'wordForPlayer' | 'player' | 'isHost' | 'round'
> & { playerCount: number; round?: Omit<Round, 'word'> };

export interface GameEvent {
  type: GameEventType;
  code: string;
  timestamp: number;
  // state es genérico (sin perspectiva de jugador). Se envía para reducir peticiones, pero cada cliente puede refrescar su vista personalizada.
  state?: BroadcastState;
  playerId?: string;
  roundId?: string;
}

interface ListenerEntry {
  fn: (ev: GameEvent) => void;
}

interface EventStore {
  listeners: Map<string, Set<ListenerEntry>>; // por código de partida
}

function getEventStore(): EventStore {
  const g = globalThis as any;
  if (!g.__IMPOSTOR_EVENT_STORE__) {
    g.__IMPOSTOR_EVENT_STORE__ = { listeners: new Map<string, Set<ListenerEntry>>() } as EventStore;
  }
  return g.__IMPOSTOR_EVENT_STORE__;
}

export function subscribe(code: string, fn: (ev: GameEvent) => void): () => void {
  const store = getEventStore();
  const key = code.toUpperCase();
  if (!store.listeners.has(key)) store.listeners.set(key, new Set());
  const entry: ListenerEntry = { fn };
  store.listeners.get(key)!.add(entry);
  return () => {
    const set = store.listeners.get(key);
    if (!set) return;
    set.delete(entry);
    if (set.size === 0) store.listeners.delete(key);
  };
}

export function emit(code: string, type: GameEventType, extra?: Partial<Omit<GameEvent, 'code' | 'type' | 'timestamp'>>): void {
  const store = getEventStore();
  const key = code.toUpperCase();
  const set = store.listeners.get(key);
  if (!set || set.size === 0) return;
  // Construir estado genérico (sin palabra individual)
  let stateLite: GameEvent['state'] = undefined;
  const fullState = getState(code);
  if (fullState) {
    let roundLite: BroadcastState['round'];
    if (fullState.round) {
      const { word: _word, ...rest } = fullState.round;
      roundLite = rest;
    }
    stateLite = {
      game: fullState.game,
      round: roundLite,
      playerCount: fullState.game.players.length,
    };
  }
  const ev: GameEvent = {
    type,
    code: key,
    timestamp: Date.now(),
    state: stateLite,
    ...extra,
  } as GameEvent;
  for (const l of set) {
    try { l.fn(ev); } catch {}
  }
}
