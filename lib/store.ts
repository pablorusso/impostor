import { nanoid } from 'nanoid';
import { Game, Player, PlayerState, Round } from './types';
import { DEFAULT_WORDS } from './words';

interface Store {
  games: Map<string, Game>;
}

function getStore(): Store {
  // In-memory singleton (NOT persistent). Suitable for short casual games.
  const g = globalThis as any;
  if (!g.__IMPOSTOR_STORE__) {
    g.__IMPOSTOR_STORE__ = { games: new Map<string, Game>() } as Store;
  }
  return g.__IMPOSTOR_STORE__;
}

export function createGame(hostName: string, words?: string[]): { code: string; hostId: string; playerId: string } {
  const store = getStore();
  let code: string;
  do {
    code = Math.random().toString(36).slice(2, 7).toUpperCase();
  } while (store.games.has(code));
  const hostId = nanoid();
  const hostPlayer: Player = { id: hostId, name: hostName.trim() };
  const game: Game = {
    code,
    hostId,
    players: [hostPlayer],
    words: (words && words.length > 0 ? words : DEFAULT_WORDS).map((w: string) => w.trim()).filter(Boolean),
  };
  store.games.set(code, game);
  return { code, hostId, playerId: hostId };
}

export function joinGame(code: string, name: string): { playerId: string } | null {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return null;
  const existing = game.players.find((p: Player) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return { playerId: existing.id }; // Reuse
  const player: Player = { id: nanoid(), name: name.trim() };
  game.players.push(player);
  return { playerId: player.id };
}

export function startRound(code: string): boolean {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return false;
  if (game.players.length < 3) return false; // mínimo
  
  // Initialize turn order if not set (first round)
  if (!game.turnOrder || game.turnOrder.length !== game.players.length) {
    const playerIds = [...game.players.map(p => p.id)];
    // Shuffle the turn order
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
    }
    game.turnOrder = playerIds;
    game.currentTurnIndex = 0;
  }
  
  const impostorIndex = Math.floor(Math.random() * game.players.length);
  const impostorId = game.players[impostorIndex].id;
  const word = game.words[Math.floor(Math.random() * game.words.length)];
  const round: Round = { id: nanoid(), impostorId, word, startedAt: Date.now() };
  game.currentRound = round;
  return true;
}

export function nextRound(code: string): boolean {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return false;
  if (game.players.length < 3) return false;
  // Marcar fin lógico de la ronda anterior si existía
  if (game.currentRound) {
    game.currentRound.endedAt = Date.now();
  }
  
  // Rotate turn order for new round (move first player to end, others shift left)
  if (game.turnOrder && game.turnOrder.length > 1) {
    const firstPlayer = game.turnOrder.shift()!; // Remove first player
    game.turnOrder.push(firstPlayer); // Add to end
  }
  game.currentTurnIndex = 0;
  
  const impostorIndex = Math.floor(Math.random() * game.players.length);
  const impostorId = game.players[impostorIndex].id;
  const word = game.words[Math.floor(Math.random() * game.words.length)];
  const round: Round = { id: nanoid(), impostorId, word, startedAt: Date.now() };
  game.currentRound = round;
  return true;
}

export function endRound(code: string): boolean {
  const game = getStore().games.get(code.toUpperCase());
  if (!game || !game.currentRound) return false;
  game.currentRound.endedAt = Date.now();
  game.currentRound = undefined;
  return true;
}

export function closeGame(code: string): boolean {
  const store = getStore();
  const key = code.toUpperCase();
  if (!store.games.has(key)) return false;
  store.games.delete(key);
  return true;
}

export function nextTurn(code: string): boolean {
  const game = getStore().games.get(code.toUpperCase());
  if (!game || !game.currentRound || !game.turnOrder || game.currentTurnIndex === undefined) return false;
  
  // Advance to next turn, wrapping around to 0 if at end
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
  return true;
}

export function getState(code: string, playerId?: string): PlayerState | null {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return null;
  const player = playerId ? game.players.find((p: Player) => p.id === playerId) : undefined;
  const round = game.currentRound;
  let wordForPlayer: string | null | undefined = undefined;
  if (round && player) {
    wordForPlayer = player.id === round.impostorId ? null : round.word;
  }
  
  // Get current turn information
  let currentTurnPlayer: Player | undefined = undefined;
  let isMyTurn = false;
  if (game.turnOrder && game.currentTurnIndex !== undefined && round) {
    const currentTurnPlayerId = game.turnOrder[game.currentTurnIndex];
    currentTurnPlayer = game.players.find(p => p.id === currentTurnPlayerId);
    isMyTurn = !!player && player.id === currentTurnPlayerId;
  }
  
  return {
    isHost: !!player && player.id === game.hostId,
    game,
    player,
    round,
    wordForPlayer,
    currentTurnPlayer,
    isMyTurn,
  };
}
