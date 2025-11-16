import { createClient } from 'redis';
import { nanoid } from 'nanoid';
import { Game, Player, PlayerState, Round } from './types';
import { DEFAULT_WORDS, findWordCategory } from './words';

const GAME_TTL = 6 * 60 * 60; // 6 hours in seconds

// Fallback store for development when Redis is not available
let memoryStore: Map<string, Game> = new Map();

// Redis client instance
let redisClient: ReturnType<typeof createClient> | null = null;

// Check if Redis environment variable is available
const isRedisAvailable = () => {
  return !!process.env.REDIS_URL;
};

// Initialize Redis client
async function getRedisClient() {
  if (!redisClient && isRedisAvailable()) {
    redisClient = createClient({
      url: process.env.REDIS_URL
    });
    
    redisClient.on('error', (err) => console.error('[REDIS] Client Error:', err));
    
    try {
      await redisClient.connect();
      console.log('[REDIS] Connected successfully');
    } catch (error) {
      console.error('[REDIS] Connection failed:', error);
      redisClient = null;
    }
  }
  return redisClient;
}

// Helper to use Redis or memory store based on environment
const getStore = () => {
  if (isRedisAvailable()) {
    console.log('[REDIS] Using Redis via REDIS_URL');
    
    return {
      async get(key: string) {
        const client = await getRedisClient();
        if (!client) return null;
        
        try {
          const data = await client.get(key);
          return data ? JSON.parse(data) : null;
        } catch (error) {
          console.error('[REDIS] Get error:', error);
          return null;
        }
      },
      async set(key: string, value: any) {
        const client = await getRedisClient();
        if (!client) return value;
        
        try {
          await client.setEx(key, GAME_TTL, JSON.stringify(value));
          return value;
        } catch (error) {
          console.error('[REDIS] Set error:', error);
          return value;
        }
      },
      async del(key: string) {
        const client = await getRedisClient();
        if (!client) return false;
        
        try {
          await client.del(key);
          return true;
        } catch (error) {
          console.error('[REDIS] Del error:', error);
          return false;
        }
      },
      async exists(key: string) {
        const client = await getRedisClient();
        if (!client) return false;
        
        try {
          const result = await client.exists(key);
          return result === 1;
        } catch (error) {
          console.error('[REDIS] Exists error:', error);
          return false;
        }
      }
    };
  } else {
    console.log('[DEV] Using memory store (Redis not configured)');
    return {
      async get(key: string) {
        return memoryStore.get(key) || null;
      },
      async set(key: string, value: any) {
        memoryStore.set(key, value);
        return value;
      },
      async del(key: string) {
        return memoryStore.delete(key);
      },
      async exists(key: string) {
        return memoryStore.has(key);
      }
    };
  }
};

// Claves para Redis/Memory
const GAME_KEY = (code: string) => `game:${code}`;
const GAME_LIST_KEY = 'games:active';
const PLAYER_KEY = (code: string, playerId: string) => `player:${code}:${playerId}`;
const PLAYER_GAME_MAP_KEY = (playerId: string) => `player_game:${playerId}`;

// Obtener un juego por código
export async function getGame(code: string): Promise<Game | null> {
  const store = getStore();
  try {
    const game = await store.get(GAME_KEY(code)) as Game | null;
    return game;
  } catch (error) {
    console.error('Error getting game:', error);
    return null;
  }
}

// Guardar cambios en un juego
export async function saveGame(game: Game): Promise<void> {
  const store = getStore();
  try {
    await store.set(GAME_KEY(game.code), game);
  } catch (error) {
    console.error('Error saving game:', error);
    throw new Error('Failed to save game');
  }
}

// Mapear PlayerID a GameCode
async function setPlayerGameMapping(playerId: string, gameCode: string): Promise<void> {
  const store = getStore();
  try {
    await store.set(PLAYER_GAME_MAP_KEY(playerId), gameCode);
  } catch (error) {
    console.error('Error setting player game mapping:', error);
  }
}

// Obtener GameCode para un PlayerID
async function getPlayerGameMapping(playerId: string): Promise<string | null> {
  const store = getStore();
  try {
    return await store.get(PLAYER_GAME_MAP_KEY(playerId)) as string | null;
  } catch (error) {
    console.error('Error getting player game mapping:', error);
    return null;
  }
}

// Remover mapeo PlayerID -> GameCode
async function removePlayerGameMapping(playerId: string): Promise<void> {
  const store = getStore();
  try {
    await store.del(PLAYER_GAME_MAP_KEY(playerId));
  } catch (error) {
    console.error('Error removing player game mapping:', error);
  }
}

// Verificar si un PlayerID está en un juego específico
export async function isPlayerInGame(playerId: string, gameCode?: string): Promise<{ inGame: boolean; currentGameCode?: string }> {
  const currentGameCode = await getPlayerGameMapping(playerId);
  
  if (!currentGameCode) {
    return { inGame: false };
  }
  
  // Verificar que el juego aún existe
  const game = await getGame(currentGameCode);
  if (!game) {
    // Limpiar mapeo si el juego no existe
    await removePlayerGameMapping(playerId);
    return { inGame: false };
  }
  
  // Verificar que el player está en el juego
  const playerInGame = game.players.find((p: Player) => p.id === playerId);
  if (!playerInGame) {
    // Limpiar mapeo si el player no está en el juego
    await removePlayerGameMapping(playerId);
    return { inGame: false };
  }
  
  if (gameCode && currentGameCode !== gameCode.toUpperCase()) {
    return { inGame: true, currentGameCode };
  }
  
  return { inGame: true, currentGameCode };
}

// Transferir host a otro jugador
async function transferHost(game: Game): Promise<void> {
  if (game.players.length === 0) return;
  
  // Encontrar nuevo host (el jugador más antiguo que no sea el host actual)
  const newHost = game.players.find((p: Player) => p.id !== game.hostId) || game.players[0];
  const oldHost = game.hostId;
  
  game.hostId = newHost.id;
  
  const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
  console.log(`[${storeType}] Host transferred from ${oldHost} to ${newHost.id} (${newHost.name}) in game ${game.code}`);
}

// Crear un nuevo juego
export async function createGame(hostPlayerId: string, hostName: string, words?: string[], shareCategories?: boolean): Promise<{ code: string; hostId: string; playerId: string }> {
  const store = getStore();
  let code: string;
  
  // Generar código único
  do {
    code = nanoid(5).toUpperCase();
  } while (await store.exists(GAME_KEY(code)));

  const hostPlayer: Player = { id: hostPlayerId, name: hostName.trim() };
  
  const game: Game = {
    code,
    hostId: hostPlayerId,
    players: [hostPlayer],
    words: (words && words.length > 0 ? words : DEFAULT_WORDS).slice().sort(() => Math.random() - 0.5),
    shareCategories: shareCategories || false,
  };

  try {
    await store.set(GAME_KEY(code), game);
    // Mapear PlayerID -> GameCode
    await setPlayerGameMapping(hostPlayerId, code);
    
    const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
    console.log(`[${storeType}] Game created: ${code} with ${game.words.length} words, host: ${hostName} (${hostPlayerId}), shareCategories: ${shareCategories}`);
    return { code, hostId: hostPlayerId, playerId: hostPlayerId };
  } catch (error) {
    console.error('Error creating game:', error);
    throw new Error('Failed to create game');
  }
}

export async function joinGame(playerId: string, code: string, name: string): Promise<{ playerId: string } | null> {
  const store = getStore();
  const game = await store.get(GAME_KEY(code.toUpperCase())) as Game | null;
  if (!game) return null;

  // Buscar si el player ya está en el juego (por ID o por nombre)
  let existingPlayer = game.players.find((p: Player) => p.id === playerId);
  
  if (!existingPlayer) {
    // Buscar por nombre para evitar duplicados
    existingPlayer = game.players.find((p: Player) => p.name.toLowerCase() === name.toLowerCase());
    
    if (existingPlayer) {
      // Actualizar el ID del player existente para que coincida con el PlayerID persistente
      existingPlayer.id = playerId;
    }
  }

  if (existingPlayer) {
    // Actualizar nombre si es necesario
    existingPlayer.name = name.trim();
    
    // Mapear PlayerID -> GameCode
    await setPlayerGameMapping(playerId, code.toUpperCase());
    
    // Guardar cambios
    await store.set(GAME_KEY(code), game);
    
    const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
    console.log(`[${storeType}] Player rejoined: ${name} (${playerId}) to game ${code}`);
    
    return { playerId };
  }

  // Crear nuevo jugador
  const player: Player = { id: playerId, name: name.trim() };

  // Agregar al juego
  game.players.push(player);

  // Si hay una partida activa y ya existe un turnOrder, agregar el nuevo jugador al final
  if (game.currentRound && game.turnOrder) {
    game.turnOrder.push(player.id);
  }

  // Mapear PlayerID -> GameCode
  await setPlayerGameMapping(playerId, code.toUpperCase());

  // Guardar
  await store.set(GAME_KEY(code), game);

  const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
  console.log(`[${storeType}] Player joined: ${name} (${playerId}) to game ${code}`);

  return { playerId };
}

export async function startRound(code: string): Promise<boolean> {
  const store = getStore();
  const game = await store.get(GAME_KEY(code.toUpperCase())) as Game | null;
  if (!game) return false;
  if (game.players.length < 2) return false;

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

  // Guardar
  await store.set(GAME_KEY(code), game);

  const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
  console.log(`[${storeType}] Round started in game ${code}: word=${word}, category=${category}, impostor=${impostorId}`);

  return true;
}

export async function nextRound(code: string): Promise<boolean> {
  const store = getStore();
  const game = await store.get(GAME_KEY(code.toUpperCase())) as Game | null;
  if (!game) return false;
  if (game.players.length < 2) return false;

  // Marcar fin lógico de la ronda anterior si existía
  if (game.currentRound) {
    game.currentRound.endedAt = Date.now();
  }

  // Sincronizar turnOrder con jugadores actuales
  if (game.turnOrder) {
    const currentPlayerIds = game.players.map(p => p.id);
    const existingInOrder = game.turnOrder.filter(id => currentPlayerIds.includes(id));
    const newPlayers = currentPlayerIds.filter(id => !game.turnOrder!.includes(id));
    game.turnOrder = [...existingInOrder, ...newPlayers];

    // Rotate turn order for new round
    if (game.turnOrder.length > 1) {
      const firstPlayer = game.turnOrder.shift()!;
      game.turnOrder.push(firstPlayer);
    }
  } else {
    game.turnOrder = game.players.map(p => p.id);
  }
  game.currentTurnIndex = 0;

  const impostorIndex = Math.floor(Math.random() * game.players.length);
  const impostorId = game.players[impostorIndex].id;
  const word = game.words[Math.floor(Math.random() * game.words.length)];
  const category = findWordCategory(word);
  const round: Round = { id: nanoid(), impostorId, word, category, startedAt: Date.now() };
  
  game.currentRound = round;

  // Guardar
  await store.set(GAME_KEY(code), game);

  const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
  console.log(`[${storeType}] Next round started in game ${code}: word=${word}, category=${category}`);

  return true;
}

export async function nextTurn(code: string): Promise<boolean> {
  const store = getStore();
  const game = await store.get(GAME_KEY(code.toUpperCase())) as Game | null;
  if (!game || !game.currentRound || !game.turnOrder) return false;

  game.currentTurnIndex = ((game.currentTurnIndex || 0) + 1) % game.turnOrder.length;

  // Guardar
  await store.set(GAME_KEY(code), game);

  const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
  console.log(`[${storeType}] Next turn in game ${code}: index=${game.currentTurnIndex}`);

  return true;
}

export async function endRound(code: string): Promise<boolean> {
  const store = getStore();
  const game = await store.get(GAME_KEY(code.toUpperCase())) as Game | null;
  if (!game || !game.currentRound) return false;

  game.currentRound.endedAt = Date.now();

  // Guardar
  await store.set(GAME_KEY(code), game);

  return true;
}

export async function closeGame(code: string): Promise<boolean> {
  const store = getStore();
  const game = await store.get(GAME_KEY(code.toUpperCase())) as Game | null;
  if (!game) return false;

  // Eliminar juego
  await store.del(GAME_KEY(code));

  const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
  console.log(`[${storeType}] Game closed: ${code}`);

  return true;
}

export async function leaveGame(code: string, playerId: string): Promise<boolean> {
  const store = getStore();
  const game = await store.get(GAME_KEY(code.toUpperCase())) as Game | null;
  if (!game) return false;

  // Remover jugador del juego
  game.players = game.players.filter(p => p.id !== playerId);
  
  // Remover del turnOrder si existe
  if (game.turnOrder) {
    const playerIndex = game.turnOrder.indexOf(playerId);
    if (playerIndex !== -1) {
      game.turnOrder.splice(playerIndex, 1);
      // Ajustar currentTurnIndex si es necesario
      if (game.currentTurnIndex !== undefined && game.currentTurnIndex >= playerIndex) {
        game.currentTurnIndex = Math.max(0, game.currentTurnIndex - 1);
      }
    }
  }

  // Limpiar mapping de PlayerID
  await removePlayerGameMapping(playerId);

  // Si no quedan jugadores, cerrar el juego
  if (game.players.length === 0) {
    return await closeGame(code);
  }

  // Verificar si había una ronda activa y el jugador que abandona es el impostor
  const wasImpostor = game.currentRound && game.currentRound.impostorId === playerId;
  const logPrefix = isRedisAvailable() ? 'REDIS' : 'DEV';
  
  // Lógica especial según número de jugadores restantes y si era impostor
  if (game.players.length < 3) {
    // Si quedan menos de 3 jugadores, volver al lobby (terminar ronda actual)
    if (game.currentRound) {
      game.currentRound.endedAt = Date.now();
      game.currentRound = undefined;
      game.turnOrder = undefined;
      game.currentTurnIndex = undefined;
      
      console.log(`[${logPrefix}] Round cancelled due to insufficient players in game ${code}`);
    }
  } else if (wasImpostor) {
    // Si el impostor abandona y hay suficientes jugadores (>=3), pasar automáticamente a siguiente palabra
    console.log(`[${logPrefix}] Impostor left game ${code}, starting next round automatically`);
    
    // Marcar fin de la ronda actual
    if (game.currentRound) {
      game.currentRound.endedAt = Date.now();
    }

    // Sincronizar turnOrder con jugadores actuales (ya filtrados arriba)
    if (game.turnOrder) {
      const currentPlayerIds = game.players.map(p => p.id);
      const existingInOrder = game.turnOrder.filter(id => currentPlayerIds.includes(id));
      const newPlayers = currentPlayerIds.filter(id => !game.turnOrder!.includes(id));
      game.turnOrder = [...existingInOrder, ...newPlayers];

      // Rotar orden de turnos para nueva ronda
      if (game.turnOrder.length > 1) {
        const firstPlayer = game.turnOrder.shift()!;
        game.turnOrder.push(firstPlayer);
      }
    } else {
      game.turnOrder = game.players.map(p => p.id);
    }
    game.currentTurnIndex = 0;

    // Crear nueva ronda con nuevo impostor y nueva palabra
    const impostorIndex = Math.floor(Math.random() * game.players.length);
    const impostorId = game.players[impostorIndex].id;
    const word = game.words[Math.floor(Math.random() * game.words.length)];
    const category = findWordCategory(word);
    const round: Round = { id: nanoid(), impostorId, word, category, startedAt: Date.now() };
    
    game.currentRound = round;
    
    const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
    console.log(`[${storeType}] New round auto-started after impostor left game ${code}: word=${word}, category=${category}, impostor=${impostorId}`);
  }

  // Si el host se fue, transferir host automáticamente
  if (game.hostId === playerId && game.players.length > 0) {
    await transferHost(game);
  }

  // Guardar cambios
  await store.set(GAME_KEY(code), game);

  const storeType = isRedisAvailable() ? 'REDIS' : 'DEV';
  console.log(`[${storeType}] Player left game ${code}: ${playerId}`);

  return true;
}

export async function getState(code: string, playerId?: string): Promise<PlayerState | null> {
  const store = getStore();
  const game = await store.get(GAME_KEY(code.toUpperCase())) as Game | null;
  if (!game) return null;

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

// Función de mantenimiento que se puede llamar periódicamente
export async function maintenance() {
  if (!isRedisAvailable()) {
    console.log('[DEV] Maintenance skipped (memory store)');
    return;
  }
  
  try {
    // En Redis, los juegos se auto-eliminan por TTL
    console.log('[REDIS] TTL-based cleanup active');
  } catch (error) {
    console.error('Error during maintenance:', error);
  }
}