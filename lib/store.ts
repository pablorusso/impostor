import { nanoid } from 'nanoid';
import { Game, Player, PlayerState, Round } from './types';
import { DEFAULT_WORDS } from './words';

interface Store {
  games: Map<string, Game>;
}

function getStore(): Store {
  // In-memory singleton con mejor persistencia para Vercel
  const g = globalThis as any;
  if (!g.__IMPOSTOR_STORE__) {
    g.__IMPOSTOR_STORE__ = { games: new Map<string, Game>() } as Store;
    
    // Cleanup automático de juegos viejos para liberar memoria
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        const now = Date.now();
        const store = g.__IMPOSTOR_STORE__ as Store;
        for (const [code, game] of store.games.entries()) {
          const lastActivity = game.currentRound?.startedAt || 0;
          // Limpiar juegos inactivos por más de 2 horas
          if (now - lastActivity > 2 * 60 * 60 * 1000) {
            store.games.delete(code);
          }
        }
      }, 10 * 60 * 1000); // Check cada 10 minutos
    }
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
  
  // Si hay una partida activa y ya existe un turnOrder, agregar el nuevo jugador al final
  if (game.currentRound && game.turnOrder) {
    game.turnOrder.push(player.id);
  }
  
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

export function leaveGame(code: string, playerId: string): { ok: boolean; gameEnded?: boolean; error?: string } {
  const game = getStore().games.get(code.toUpperCase());
  if (!game) return { ok: false, error: 'Game not found' };
  
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { ok: false, error: 'Player not found' };
  
  // No permitir que el host abandone (debe cerrar el juego)
  if (game.hostId === playerId) {
    return { ok: false, error: 'Host cannot leave, must close game' };
  }
  
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
  
  // Si quedan menos de 3 jugadores, terminar ronda actual
  if (game.players.length < 3 && game.currentRound) {
    game.currentRound.endedAt = Date.now();
    game.currentRound = undefined;
    game.turnOrder = undefined;
    game.currentTurnIndex = undefined;
  }
  
  return { ok: true };
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
