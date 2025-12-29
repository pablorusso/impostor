import { nanoid, customAlphabet } from 'nanoid';
import { Game, Player, PlayerState, Round } from './types';
import { DEFAULT_WORDS, findWordCategory } from './words';

interface Store {
  games: Map<string, Game>;
  publicGames: Set<string>;
}

function getStore(): Store {
  const g = globalThis as any;
  const storeKey = '__IMPOSTOR_GAME_STORE__';
  
  if (!g[storeKey]) {
    console.log('[Store] Initializing new game store instance');
    
    g[storeKey] = { 
      games: new Map<string, Game>(),
      publicGames: new Set<string>(),
      lastAccess: Date.now()
    } as Store & { lastAccess: number };
    
    // Cleanup simple cada 30 minutos
    if (typeof setInterval !== 'undefined') {
      const cleanupInterval = setInterval(() => {
        const store = g[storeKey] as Store & { lastAccess: number };
        
        if (!store || !store.games) {
          clearInterval(cleanupInterval);
          return;
        }
        
        store.lastAccess = Date.now();
        const now = Date.now();
        
        // Limpiar juegos inactivos de más de 2 horas
        for (const [code, game] of store.games.entries()) {
          const lastActivity = Math.max(
            game.currentRound?.startedAt || 0,
            game.players.reduce((latest, p) => Math.max(latest, (p as any).lastSeen || 0), 0),
            (game as any).lastUpdate || 0
          );
          
          if (now - lastActivity > 2 * 60 * 60 * 1000) {
            console.log(`[Store] Cleaning up inactive game: ${code}`);
            store.games.delete(code);
          }
        }
      }, 30 * 60 * 1000); // Check cada 30 minutos
    }
  }
  
  const store = g[storeKey] as Store & { lastAccess: number };
  store.lastAccess = Date.now();
  
  return store;
}

const DEFAULT_IMPOSTOR_MIN = 1;
const DEFAULT_IMPOSTOR_MAX = 1;

function getImpostorLimits(game: Game) {
  const rawMin = Number(game.impostorCountMin);
  const rawMax = Number(game.impostorCountMax);
  const min = Number.isFinite(rawMin) ? Math.max(1, Math.floor(rawMin)) : DEFAULT_IMPOSTOR_MIN;
  const maxBase = Number.isFinite(rawMax) ? Math.max(1, Math.floor(rawMax)) : DEFAULT_IMPOSTOR_MAX;
  const max = Math.max(min, maxBase);
  return { min, max };
}

function getMinPlayersForGame(game: Game) {
  const { max } = getImpostorLimits(game);
  return max + 2;
}

function pickImpostorIds(players: Player[], min: number, max: number): string[] {
  const maxPossible = Math.min(max, players.length);
  const minPossible = Math.min(min, maxPossible);
  if (maxPossible <= 0) return [];
  const impostorCount = minPossible === maxPossible
    ? minPossible
    : Math.floor(Math.random() * (maxPossible - minPossible + 1)) + minPossible;
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, impostorCount).map(p => p.id);
}

function ensureImpostorIds(players: Player[], impostorIds: string[]): string[] {
  if (impostorIds.length > 0) return impostorIds;
  if (players.length === 0) return impostorIds;
  const fallbackIndex = Math.floor(Math.random() * players.length);
  return [players[fallbackIndex].id];
}

function getRoundImpostorIds(round?: Round): string[] {
  if (!round) return [];
  if (Array.isArray(round.impostorIds) && round.impostorIds.length > 0) return round.impostorIds;
  if (round.impostorId) return [round.impostorId];
  return [];
}

export function createGame(
  hostName: string,
  words?: string[],
  shareCategories?: boolean,
  allowAllKick: boolean = true,
  isPublic: boolean = false,
  impostorCountMin: number = DEFAULT_IMPOSTOR_MIN,
  impostorCountMax: number = DEFAULT_IMPOSTOR_MAX
): { code: string; hostId: string; playerId: string } {
  const store = getStore();
  const generateGameCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);
  let code: string;
  do {
    code = generateGameCode();
  } while (store.games.has(code));
  const hostId = nanoid();
  const hostPlayer: Player = { id: hostId, name: hostName.trim() };
  const safeImpostorMin = Math.max(1, Math.floor(impostorCountMin || DEFAULT_IMPOSTOR_MIN));
  const safeImpostorMax = Math.max(safeImpostorMin, Math.floor(impostorCountMax || safeImpostorMin));
  const game: Game = {
    code,
    hostId,
    players: [hostPlayer],
    words: (words && words.length > 0 ? words : DEFAULT_WORDS).map((w: string) => w.trim()).filter(Boolean),
    impostorCountMin: safeImpostorMin,
    impostorCountMax: safeImpostorMax,
    shareCategories: shareCategories || false,
    allowAllKick,
    isPublic,
  };
  
  // Añadir timestamp para tracking
  (game as any).lastUpdate = Date.now();
  (hostPlayer as any).lastSeen = Date.now();
  
  store.games.set(code, game);
  if (isPublic) {
    store.publicGames.add(code.toUpperCase());
  }
  
  return { code, hostId, playerId: hostId };
}

export function joinGame(code: string, name: string): { playerId: string } | null {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return null;
  const existing = game.players.find((p: Player) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return { playerId: existing.id }; // Reuse
  const player: Player = { id: nanoid(), name: name.trim() };
  (player as any).lastSeen = Date.now();
  game.players.push(player);
  
  // Actualizar timestamp del juego
  (game as any).lastUpdate = Date.now();
  
  // Si hay una partida activa y ya existe un turnOrder, agregar el nuevo jugador al final
  if (game.currentRound && game.turnOrder) {
    game.turnOrder.push(player.id);
  }
  
  return { playerId: player.id };
}

export function startRound(code: string): boolean {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return false;
  const minPlayers = getMinPlayersForGame(game);
  if (game.players.length < minPlayers) return false;
  const { min, max } = getImpostorLimits(game);
  
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
  
  const impostorIds = ensureImpostorIds(
    game.players,
    pickImpostorIds(game.players, min, max)
  );
  const word = game.words[Math.floor(Math.random() * game.words.length)];
  const category = findWordCategory(word);
  const round: Round = { id: nanoid(), impostorIds, impostorId: impostorIds[0], word, category, startedAt: Date.now() };
  game.currentRound = round;
  getStore().publicGames.delete(code.toUpperCase());
  
  return true;
}

export function nextRound(code: string): boolean {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return false;
  const minPlayers = getMinPlayersForGame(game);
  if (game.players.length < minPlayers) return false;
  const { min, max } = getImpostorLimits(game);
  // Marcar fin lógico de la ronda anterior si existía
  if (game.currentRound) {
    game.currentRound.endedAt = Date.now();
  }
  
  // Sincronizar turnOrder con jugadores actuales (por si se unieron nuevos durante la partida)
  if (game.turnOrder) {
    // Mantener el orden actual de jugadores existentes, agregar nuevos al final
    const currentPlayerIds = game.players.map(p => p.id);
    const existingInOrder = game.turnOrder.filter(id => currentPlayerIds.includes(id));
    const newPlayers = currentPlayerIds.filter(id => !game.turnOrder!.includes(id));
    game.turnOrder = [...existingInOrder, ...newPlayers];
    
    // Rotate turn order for new round (move first player to end, others shift left)
    if (game.turnOrder.length > 1) {
      const firstPlayer = game.turnOrder.shift()!; // Remove first player
      game.turnOrder.push(firstPlayer); // Add to end
    }
  } else {
    // Si no hay turnOrder, inicializarlo (caso edge)
    game.turnOrder = game.players.map(p => p.id);
  }
  game.currentTurnIndex = 0;
  
  const impostorIds = ensureImpostorIds(
    game.players,
    pickImpostorIds(game.players, min, max)
  );
  const word = game.words[Math.floor(Math.random() * game.words.length)];
  const category = findWordCategory(word);
  const round: Round = { id: nanoid(), impostorIds, impostorId: impostorIds[0], word, category, startedAt: Date.now() };
  game.currentRound = round;
  getStore().publicGames.delete(code.toUpperCase());
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
  store.publicGames.delete(key);
  store.games.delete(key);
  return true;
}

export function nextTurn(code: string, playerId?: string): boolean {
  const game = getStore().games.get(code.toUpperCase());
  if (!game || !game.currentRound || !game.turnOrder || game.currentTurnIndex === undefined) return false;
  if (!playerId || playerId !== game.hostId) return false;
  
  // Advance to next turn, wrapping around to 0 if at end
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
  return true;
}

export function reportImpostorFound(code: string, playerId?: string): { ok: boolean; allFound?: boolean } {
  const game = getStore().games.get(code.toUpperCase());
  if (!game || !game.currentRound) return { ok: false };
  if (!playerId || playerId !== game.hostId) return { ok: false };

  const round = game.currentRound;
  const totalImpostors = getRoundImpostorIds(round).length;
  if (totalImpostors <= 0) return { ok: false };

  const currentFound = Math.min(round.foundImpostorCount ?? 0, totalImpostors);
  const nextFound = Math.min(currentFound + 1, totalImpostors);

  if (nextFound >= totalImpostors) {
    const ok = nextRound(code);
    return { ok, allFound: ok ? true : undefined };
  }

  round.foundImpostorCount = nextFound;
  return { ok: true, allFound: false };
}

export function leaveGame(code: string, playerId: string): { ok: boolean; gameEnded?: boolean; error?: string } {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return { ok: false, error: 'Game not found' };
  
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { ok: false, error: 'Player not found' };
  
  // Remover jugador
  game.players.splice(playerIndex, 1);
  
  // Actualizar orden de turnos si existe
  if (game.turnOrder) {
    const turnIndex = game.turnOrder.indexOf(playerId);
    if (turnIndex !== -1) {
      game.turnOrder.splice(turnIndex, 1);
      
      // Ajustar currentTurnIndex si es necesario
      if (game.currentTurnIndex !== undefined) {
        if (turnIndex < game.currentTurnIndex) {
          game.currentTurnIndex--;
        } else if (turnIndex === game.currentTurnIndex && game.currentTurnIndex >= game.turnOrder.length) {
          game.currentTurnIndex = 0;
        }
        
        // Si no quedan turnos, resetear
        if (game.turnOrder.length === 0) {
          game.currentTurnIndex = 0;
        }
      }
    }
  }
  
  const minPlayers = getMinPlayersForGame(game);
  // Si quedan menos jugadores que el minimo requerido, terminar ronda actual
  if (game.players.length < minPlayers && game.currentRound) {
    game.currentRound.endedAt = Date.now();
    game.currentRound = undefined;
    game.turnOrder = undefined;
    game.currentTurnIndex = undefined;
  }

  if (game.players.length === 0) {
    closeGame(code);
    return { ok: true, gameEnded: true };
  }
  
  return { ok: true };
}

export function getState(code: string, playerId?: string): PlayerState | null {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return null;
  
  // Actualizar lastSeen del jugador si está especificado
  if (playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (player) {
      (player as any).lastSeen = Date.now();
    }
  }
  
  // Actualizar timestamp del juego en cada acceso
  (game as any).lastUpdate = Date.now();
  const player = playerId ? game.players.find((p: Player) => p.id === playerId) : undefined;
  const round = game.currentRound;
  let wordForPlayer: string | null | undefined = undefined;
  let categoryForPlayer: string | undefined = undefined;
  if (round && player) {
    const isImpostor = getRoundImpostorIds(round).includes(player.id);
    if (isImpostor) {
      // El impostor ve null para la palabra
      wordForPlayer = null;
      // Si shareCategories está activado, el impostor también ve la categoría
      if (game.shareCategories) {
        categoryForPlayer = round.category;
      }
    } else {
      // Los jugadores normales ven la palabra y siempre ven la categoría
      wordForPlayer = round.word;
      categoryForPlayer = round.category;
    }
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
    categoryForPlayer,
    currentTurnPlayer,
    isMyTurn,
  };
}
