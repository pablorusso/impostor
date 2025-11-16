import { nanoid } from 'nanoid';
import { Game, Player, PlayerState, Round } from './types';
import { DEFAULT_WORDS, findWordCategory } from './words';

interface Store {
  games: Map<string, Game>;
}

function getStore(): Store {
  // Persistencia ultra-robusta para Vercel - múltiples estrategias de backup
  const g = globalThis as any;
  
  // Usar múltiples claves para redundancia
  const storeKey = '__IMPOSTOR_GAME_STORE_V3__';
  const backupKey = '__IMPOSTOR_BACKUP_STORE__';
  
  if (!g[storeKey]) {
    console.log('[Store] Initializing new ultra-robust game store instance');
    
    // Intentar recuperar desde backup si existe
    let restoredGames = new Map<string, Game>();
    if (g[backupKey] && g[backupKey].games) {
      try {
        console.log('[Store] Attempting to restore from backup');
        const backupData = g[backupKey];
        restoredGames = new Map(backupData.games);
        console.log(`[Store] Restored ${restoredGames.size} games from backup`);
      } catch (error) {
        console.warn('[Store] Failed to restore from backup:', error);
      }
    }
    
    g[storeKey] = { 
      games: restoredGames,
      lastAccess: Date.now(),
      instanceId: Math.random().toString(36).substr(2, 9),
      heartbeat: Date.now(),
      saveCount: 0
    } as Store & { lastAccess: number; instanceId: string; heartbeat: number; saveCount: number };
    
    // Sistema de backup y heartbeat para ultra-robustez
    if (typeof setInterval !== 'undefined') {
      // Heartbeat más frecuente
      const heartbeatInterval = setInterval(() => {
        const store = g[storeKey] as Store & { heartbeat: number; saveCount: number };
        if (!store) {
          clearInterval(heartbeatInterval);
          return;
        }
        store.heartbeat = Date.now();
      }, 30 * 1000); // Cada 30 segundos
      
      // Backup automático
      const backupInterval = setInterval(() => {
        const store = g[storeKey] as Store & { saveCount: number };
        if (!store || !store.games) {
          clearInterval(backupInterval);
          return;
        }
        
        try {
          // Crear backup de toda la data
          g[backupKey] = {
            games: Array.from(store.games.entries()),
            timestamp: Date.now(),
            saveCount: store.saveCount++
          };
          console.log(`[Store] Backup created (#${store.saveCount}) with ${store.games.size} games`);
        } catch (error) {
          console.error('[Store] Backup failed:', error);
        }
      }, 2 * 60 * 1000); // Backup cada 2 minutos
      
      // Cleanup conservador
      const cleanupInterval = setInterval(() => {
        const now = Date.now();
        const store = g[storeKey] as Store & { lastAccess: number };
        
        if (!store || !store.games) {
          clearInterval(cleanupInterval);
          return;
        }
        
        store.lastAccess = now;
        
        // Cleanup más conservador - solo juegos realmente viejos
        for (const [code, game] of store.games.entries()) {
          const lastActivity = Math.max(
            game.currentRound?.startedAt || 0,
            game.players.reduce((latest, p) => Math.max(latest, (p as any).lastSeen || 0), 0),
            (game as any).lastUpdate || 0
          );
          
          // 2 horas para ser muy conservador
          if (now - lastActivity > 2 * 60 * 60 * 1000) {
            console.log(`[Store] Cleaning up very old game: ${code}`);
            store.games.delete(code);
          }
        }
      }, 10 * 60 * 1000); // Check cada 10 minutos
    }
  }
  
  const store = g[storeKey] as Store & { lastAccess: number; instanceId: string; heartbeat: number };
  store.lastAccess = Date.now();
  store.heartbeat = Date.now();
  
  return store;
}

export function createGame(hostName: string, words?: string[], shareCategories?: boolean): { code: string; hostId: string; playerId: string } {
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
    shareCategories: shareCategories || false,
  };
  
  // Añadir timestamp para tracking
  (game as any).lastUpdate = Date.now();
  (hostPlayer as any).lastSeen = Date.now();
  
  store.games.set(code, game);
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
  const category = findWordCategory(word);
  const round: Round = { id: nanoid(), impostorId, word, category, startedAt: Date.now() };
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
  const category = findWordCategory(word);
  const round: Round = { id: nanoid(), impostorId, word, category, startedAt: Date.now() };
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
    const isImpostor = player.id === round.impostorId;
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
