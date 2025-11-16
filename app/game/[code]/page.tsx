"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { PlayerState } from '../../../lib/types';
import { Box, Button, Card, Typography, TextField, Chip, Stack, Divider, List, ListItem, ListItemText } from '@mui/material';
import { useConnection } from '../../contexts/ConnectionContext';
import { CATEGORY_DISPLAY_INFO } from '../../../lib/words';
import { PlayerSession } from '../../../lib/player-session';
// Detectar Safari
function isSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
}

// Leer playerId sólo en cliente tras el montaje para evitar discrepancias SSR/CSR y errores de hidratación.
function readPlayerIdClient(): string | undefined {
  const pidParam = new URLSearchParams(window.location.search).get('pid');
  const stored = sessionStorage.getItem('playerId');
  return pidParam || stored || undefined;
}

// Función para detectar si perdimos la sesión del juego
function detectSessionLoss(data: any, playerId: string): boolean {
  if (!data || !data.game || !data.player) {
    console.warn('[Session] Missing game or player data');
    return true;
  }
  
  // Verificar que nuestro player ID existe en la lista de jugadores
  const playerExists = data.game.players.some((p: any) => p.id === playerId);
  if (!playerExists) {
    console.warn('[Session] Player ID not found in game players');
    return true;
  }
  
  return false;
}

// Función de recuperación automática para Safari
async function safariRecovery(code: string, currentPlayerId: string): Promise<string | null> {
  if (!isSafari()) return null;
  
  try {
    console.log('[Safari] Attempting session recovery');
    
    // Intentar obtener información del juego sin playerId
    const gameRes = await fetch(`/api/game/${code}/state`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!gameRes.ok) return null;
    
    const gameData = await gameRes.json();
    if (!gameData || !gameData.game) return null;
    
    // Buscar si hay un jugador con el mismo nombre que tenemos guardado
    const savedName = sessionStorage.getItem('playerName');
    if (!savedName) return null;
    
    const existingPlayer = gameData.game.players.find((p: any) => 
      p.name.toLowerCase() === savedName.toLowerCase()
    );
    
    if (existingPlayer) {
      console.log('[Safari] Found existing player, recovering session');
      sessionStorage.setItem('playerId', existingPlayer.id);
      return existingPlayer.id;
    }
    
  } catch (error) {
    console.warn('[Safari] Recovery failed:', error);
  }
  
  return null;
}

export default function GameLobby({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const [playerId, setPlayerId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [state, setState] = useState<PlayerState | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordRevealing, setWordRevealing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [lastRoundId, setLastRoundId] = useState<string | null>(null);
  const [showTurnInfo, setShowTurnInfo] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [defaultName, setDefaultName] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [wasMyTurnPreviously, setWasMyTurnPreviously] = useState(false);

  // Función para vibración en móviles
  const vibrateOnTurn = useCallback(() => {
    console.log('[Vibration] Attempting to vibrate for turn notification');
    
    // Verificar si el navegador soporta vibración
    if ('vibrate' in navigator) {
      try {
        // Verificar si estamos en HTTPS o localhost (requerido para vibración en algunos navegadores)
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
        if (!isSecure) {
          console.warn('[Vibration] May not work on non-HTTPS sites in some browsers');
        }
        
        // Patrón de vibración: vibrar 200ms, pausa 100ms, vibrar 200ms
        const success = navigator.vibrate([200, 100, 200]);
        console.log('[Vibration] Vibration result:', success);
        
        // Fallback: si el patrón no funciona, intentar vibración simple
        if (!success) {
          console.log('[Vibration] Pattern failed, trying simple vibration');
          navigator.vibrate(300);
        }
      } catch (error) {
        console.warn('[Vibration] Failed to vibrate:', error);
      }
    } else {
      console.log('[Vibration] API not supported on this device/browser');
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        console.log('[Vibration] User agent:', (navigator as any).userAgent);
      }
    }
  }, []);

  // Inicializar nombre por defecto una sola vez al montar
  useEffect(() => {
    const savedName = PlayerSession.getLastPlayerName();
    if (savedName) {
      setDefaultName(savedName);
      setName(savedName);
    }
  }, []);

  // Detectar cambios de turno para activar vibración
  useEffect(() => {
    if (state && state.isMyTurn && !wasMyTurnPreviously) {
      console.log('[Vibration] Turn change detected - it\'s now my turn');
      vibrateOnTurn();
      setWasMyTurnPreviously(true);
    } else if (state && !state.isMyTurn && wasMyTurnPreviously) {
      console.log('[Vibration] Turn change detected - no longer my turn');
      setWasMyTurnPreviously(false);
    }
  }, [state, wasMyTurnPreviously, vibrateOnTurn]);

  const refresh = useCallback(async () => {
    if (!playerId) return;
    
    try {
      // Timeout más conservador para Vercel con headers específicos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      console.log(`[Refresh] Fetching state for player: ${playerId}`);
      
      const res = await fetch(`/api/game/${code}/state?pid=${playerId}`, {
        signal: controller.signal,
        cache: 'no-store', // Evitar cache en Vercel
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (res.status === 404) {
        console.log('[Refresh] Game not found (404), redirecting to home');
        // Sala cerrada o no existe: limpiar completamente y redirigir
        sessionStorage.clear();
        setState(null);
        setPlayerId(undefined);
        setName('');
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
        return;
      }
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Refresh] Received data:', { 
          hasGame: !!data?.game, 
          hasPlayer: !!data?.player, 
          playerName: data?.player?.name 
        });
        
        // Detectar pérdida de sesión
        if (detectSessionLoss(data, playerId)) {
          console.warn('[Refresh] Session loss detected');
          
          // Intentar recuperación automática para Safari
          if (isSafari()) {
            const recoveredId = await safariRecovery(code, playerId);
            if (recoveredId) {
              console.log('[Safari] Session recovered successfully');
              setPlayerId(recoveredId);
              // Reintentar con el ID recuperado
              setTimeout(() => refresh(), 1000);
              return;
            }
          }
          
          // Si no se puede recuperar, limpiar y redirigir
          console.log('[Refresh] Cannot recover session, redirecting to home');
          sessionStorage.clear();
          setState(null);
          setPlayerId(undefined);
          // Solo limpiar nombre si ya estaba conectado
          if (playerId) {
            setName('');
          }
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
          return;
        }
        
        // Verificar integridad completa de los datos
        if (data && data.game && data.player && data.player.name) {
          // Guardar nombre del jugador para posible recuperación
          sessionStorage.setItem('playerName', data.player.name);
          setState(data);
        } else {
          console.warn('[Refresh] Incomplete data received, structure check failed');
          // Intentar una vez más después de un delay
          setTimeout(() => {
            if (playerId) {
              console.log('[Refresh] Retrying after invalid data...');
              refresh();
            }
          }, 3000);
        }
      } else {
        console.warn(`[Refresh] Server returned status ${res.status}, retrying...`);
        // Reintentar después de un delay
        setTimeout(() => {
          if (playerId) refresh();
        }, 3000);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[Refresh] Request timeout, retrying...');
      } else {
        console.warn('[Refresh] Network error:', error);
      }
      // Reintentar después de un delay más largo
      setTimeout(() => {
        if (playerId) {
          console.log('[Refresh] Retrying after error...');
          refresh();
        }
      }, 5000);
    }
  }, [playerId, code]);

  // Inicializar playerId tras montaje.
  useEffect(() => {
    if (playerId === undefined) {
      // Check URL parameter first, then fall back to persistent system
      const urlPid = readPlayerIdClient();
      const pid = urlPid || PlayerSession.getPlayerId();
      
      // Check if player has an active game first
      const checkActiveGame = async () => {
        try {
          const res = await fetch(`/api/player/${pid}/status`);
          if (res.ok) {
            const status = await res.json();
            if (status.inGame && status.currentGameCode) {
              // If player has an active game but it's not this one, redirect
              if (status.currentGameCode !== code) {
                window.location.href = `/game/${status.currentGameCode}?pid=${pid}`;
                return;
              }
              // If it's this game, try to auto-join
              setPlayerId(pid);
              return;
            }
          }
        } catch (error) {
          console.error('Error checking player status:', error);
        }
        
        // Continue with normal validation if no active game
        try {
          const res = await fetch(`/api/game/${code}/state?pid=${pid}`);
          if (res.ok) {
            const data = await res.json();
            // Verificar que el jugador tenga nombre y esté correctamente registrado
            if (data && data.player && data.player.name && !detectSessionLoss(data, pid)) {
              sessionStorage.setItem('playerId', pid);
              sessionStorage.setItem('playerName', data.player.name);
              setPlayerId(pid);
            } else {
              console.warn('[Init] Session validation failed, attempting recovery');
              
              // Intentar recuperación para Safari
              if (isSafari()) {
                const recoveredId = await safariRecovery(code, pid);
                if (recoveredId) {
                  console.log('[Init] Safari recovery successful');
                  sessionStorage.setItem('playerId', recoveredId);
                  setPlayerId(recoveredId);
                  return;
                }
              }
              
              // Si no se puede recuperar, limpiar todo
              console.log('[Init] Cannot recover, clearing session');
              sessionStorage.clear();
              setPlayerId(undefined);
              setName('');
            }
          } else {
            console.warn('[Init] Invalid playerId, attempting recovery');
            
            // Intentar recuperación para Safari
            if (isSafari()) {
              const recoveredId = await safariRecovery(code, pid);
              if (recoveredId) {
                console.log('[Init] Safari recovery successful');
                sessionStorage.setItem('playerId', recoveredId);
                setPlayerId(recoveredId);
                return;
              }
            }
            
            // Si no se puede recuperar, limpiar completamente
            sessionStorage.clear();
            setPlayerId(undefined);
            // Solo limpiar nombre si ya estaba conectado
            if (playerId) {
              setName('');
            }
          }
        } catch (error) {
          console.warn('[Init] Network error, attempting recovery');
          
          // Intentar recuperación para Safari
          if (isSafari()) {
            const recoveredId = await safariRecovery(code, pid);
            if (recoveredId) {
              console.log('[Init] Safari recovery successful');
              sessionStorage.setItem('playerId', recoveredId);
              setPlayerId(recoveredId);
              return;
            }
          }
          
          // En caso de error de red, limpiar completamente
          sessionStorage.clear();
          setPlayerId(undefined);
          // Solo limpiar nombre si ya estaba conectado
          if (playerId) {
            setName('');
          }
        }
      };
      
      checkActiveGame().finally(() => {
        setInitializing(false);
      });
    } else {
      setInitializing(false);
    }
  }, [playerId, code]);

  // Usar polling como mecanismo principal para máxima estabilidad
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastStateRef = useRef<string | null>(null);
  const { setConnectionStatus, setRetryCount } = useConnection();
  
  useEffect(() => {
    if (!playerId) return;
    
    console.log('[Connection] Starting robust polling mode for maximum stability');
    setConnectionStatus('connecting');
    
    // Polling agresivo con detección proactiva de cambios
    const startPolling = () => {
      let consecutiveErrors = 0;
      const maxErrors = 5;
      
      const poll = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout más corto
          
          const res = await fetch(`/api/game/${code}/state?pid=${playerId}&t=${Date.now()}`, {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (res.status === 404) {
            console.log('[Polling] Game not found, redirecting to home');
            sessionStorage.clear();
            window.location.href = '/';
            return;
          }
          
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          
          const newState = await res.json();
          
          // Detectar si el jugador fue expulsado (juego existe pero jugador no está en la lista)
          if (newState && newState.game && !newState.player) {
            console.log('[Polling] Player no longer in game (expelled), redirecting to home');
            sessionStorage.clear();
            window.location.href = '/';
            return;
          }
          
          const stateHash = JSON.stringify(newState);
          
          // Detectar cambios en el estado
          if (lastStateRef.current !== stateHash) {
            console.log('[Polling] State change detected, updating');
            setState(newState);
            lastStateRef.current = stateHash;
          }
          
          // Reset error counter on success
          consecutiveErrors = 0;
          setConnectionStatus('connected');
          setRetryCount(0);
          
        } catch (error: any) {
          consecutiveErrors++;
          console.warn(`[Polling] Error (${consecutiveErrors}/${maxErrors}):`, error.message);
          
          if (consecutiveErrors >= maxErrors) {
            setConnectionStatus('error');
            setRetryCount(prev => {
              const newCount = prev + 1;
              
              if (newCount >= 10) {
                console.log('[Polling] Too many failed attempts, redirecting to home');
                sessionStorage.clear();
                window.location.href = '/';
                return newCount;
              }
              
              // Backoff exponencial pero limitado
              const backoffTime = Math.min(1000 * Math.pow(1.5, newCount), 10000);
              console.log(`[Polling] Backing off for ${backoffTime}ms`);
              setTimeout(() => {
                setConnectionStatus('connecting');
                consecutiveErrors = 0;
              }, backoffTime);
              
              return newCount;
            });
          }
        }
      };
      
      // Carga inicial
      poll();
      
      // Polling cada 1.5 segundos para balance entre responsividad y carga
      pollingRef.current = setInterval(poll, 1500);
    };
    
    startPolling();
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [code, playerId, setConnectionStatus, setRetryCount]);

  // Detectar nueva ronda e iniciar animación
  useEffect(() => {
    if (state?.round && state.round.id !== lastRoundId) {
      setLastRoundId(state.round.id);
      setWordRevealing(true);
      setCountdown(3);
      setShowTurnInfo(false);
      setShowControls(false);
      
      // Mostrar información de turno después de 4 segundos de la palabra
      setTimeout(() => {
        setShowTurnInfo(true);
      }, 4000);
      
      // Mostrar controles después de 4.8 segundos
      setTimeout(() => {
        setShowControls(true);
      }, 4800);
    }
  }, [state?.round, lastRoundId]);

  // Detectar cambio de turno y vibrar en móviles
  useEffect(() => {
    // Solo activar si hay una ronda activa y el estado está completo
    if (state?.round && state.isMyTurn !== undefined) {
      // Si ahora es mi turno pero antes no lo era, vibrar
      if (state.isMyTurn && !wasMyTurnPreviously) {
        console.log('[Turn] It is now my turn, triggering vibration');
        vibrateOnTurn();
      }
      
      // Actualizar el estado anterior
      setWasMyTurnPreviously(state.isMyTurn);
    }
  }, [state?.isMyTurn, state?.round, wasMyTurnPreviously, vibrateOnTurn]);

  // Contador regresivo para revelado
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (wordRevealing && countdown === 0) {
      setTimeout(() => {
        setWordRevealing(false);
      }, 500); // Pequeño delay para la animación final
    }
  }, [countdown, wordRevealing]);

  async function join() {
    setJoining(true); setError(null);
    try {
      const currentPlayerId = PlayerSession.getPlayerId();
      
      // Save player name for future sessions
      PlayerSession.savePlayerName(name);
      
      const res = await fetch(`/api/game/${code}/join`, { 
        method: 'POST', 
        body: JSON.stringify({ 
          playerId: currentPlayerId,
          name 
        }) 
      });
      if (!res.ok) throw new Error('No se pudo unir');
      const data = await res.json();
      
      // Verificar que la respuesta tenga los datos esperados
      if (data && data.playerId) {
        sessionStorage.setItem('playerId', data.playerId);
        sessionStorage.setItem('playerName', name);
        setPlayerId(data.playerId);
        setName('');
        setTimeout(refresh, 300);
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (e:any) { 
      setError(e.message);
    } finally { 
      setJoining(false); 
    }
  }

  async function startRound() {
    await fetch(`/api/game/${code}/start-round`, { method: 'POST' });
    setTimeout(refresh, 300);
  }
  async function nextRound() {
    await fetch(`/api/game/${code}/next-round`, { method: 'POST' });
    setTimeout(refresh, 300);
  }
  async function nextTurn() {
    await fetch(`/api/game/${code}/next-turn`, { method: 'POST' });
    setTimeout(refresh, 300);
  }
  async function closeGame() {
    try {
      const res = await fetch(`/api/game/${code}/close`, { method: 'POST' });
      if (res.ok || res.status === 404) {
        // Si el juego se cerró correctamente o ya no existe (404), limpiar y redirigir
        sessionStorage.clear();
        window.location.href = '/';
      }
    } catch (error) {
      // En caso de error de red, también limpiar y redirigir
      sessionStorage.clear();
      window.location.href = '/';
    }
  }

  async function leaveGame() {
    try {
      const res = await fetch(`/api/game/${code}/leave`, { 
        method: 'POST', 
        body: JSON.stringify({ playerId }) 
      });
      if (res.ok || res.status === 404) {
        // Si se abandonó correctamente o el juego ya no existe, limpiar y redirigir
        sessionStorage.clear();
        window.location.href = '/';
      }
    } catch (error) {
      // En caso de error de red, también limpiar y redirigir
      sessionStorage.clear();
      window.location.href = '/';
    }
  }

  async function kickPlayer(targetPlayerId: string, playerName: string) {
    if (!confirm(`¿Estás seguro de que quieres expulsar a ${playerName}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/game/${code}/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          hostPlayerId: playerId, 
          targetPlayerId 
        })
      });

      if (res.ok) {
        console.log(`Player ${playerName} kicked successfully`);
        setTimeout(refresh, 300); // Refrescar el estado del juego
      } else {
        const errorData = await res.json();
        console.error('Error kicking player:', errorData.error);
        alert(`Error al expulsar jugador: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Network error kicking player:', error);
      alert('Error de red al expulsar jugador');
    }
  }

  const isRoundActive = !!state?.round;
  const wordVisible = isRoundActive ? (state?.wordForPlayer === null ? 'Eres el IMPOSTOR' : state?.wordForPlayer) : null;
  
  // Mostrar categoría si está disponible
  const categoryVisible = state?.categoryForPlayer;
  const categoryInfo = categoryVisible ? CATEGORY_DISPLAY_INFO[categoryVisible as keyof typeof CATEGORY_DISPLAY_INFO] : null;

  // Show loading while initializing to avoid premature join form display
  if (initializing) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#fbe9e7', p: 2, pt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
        <Card sx={{ p: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
          <Typography variant="h5" sx={{ color: '#e64a19', mb: 2 }}>
            🎪 Partida {code}
          </Typography>
          <Typography variant="body1" sx={{ color: '#1976d2' }}>
            ⏳ Cargando...
          </Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fbe9e7', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Card sx={{ maxWidth: 430, width: '100%', mb: 2, p: { xs: 2, sm: 3 }, boxShadow: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1, position: 'relative' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#e64a19' }}>
            🎪 Partida {code}
          </Typography>
          {state?.isHost && (
            <Button
              size="small"
              onClick={() => {
                const url = window.location.origin + window.location.pathname;
                navigator.clipboard.writeText(url).then(() => {
                  // Feedback visual temporal
                  const btn = document.querySelector('[data-copy-btn="true"]') as HTMLElement;
                  if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = '✅';
                    setTimeout(() => {
                      btn.textContent = originalText;
                    }, 1500);
                  }
                }).catch(() => {
                  alert('No se pudo copiar el link. URL: ' + url);
                });
              }}
              sx={{ 
                minWidth: 'auto', 
                p: 0.5, 
                fontSize: 16,
                color: '#1976d2',
                '&:hover': { bgcolor: '#e3f2fd' }
              }}
              data-copy-btn="true"
            >
              📋
            </Button>
          )}
        </Box>
          {!playerId && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ color: '#1976d2', mb: 1 }}>
                👋 Unirte
              </Typography>
              <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ mb: 2 }}>
                <TextField 
                  value={name} 
                  onChange={e=>setName(e.target.value)} 
                  placeholder="Tu nombre" 
                  label="Tu nombre" 
                  inputProps={{ maxLength: 30 }} 
                  size="medium" 
                  sx={{ flex: 1 }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && name && !joining) {
                      join();
                    }
                  }}
                />
                <Button variant="contained" color="primary" size="large" sx={{ fontSize: 18, px: 3, py: 1.2, borderRadius: 3 }} disabled={!name || joining} onClick={join}>
                  {joining ? '⏳ Uniendo...' : '✅ Unirse'}
                </Button>
              </Stack>
              {error && <Typography color="error" sx={{ fontSize: 16 }}>{error}</Typography>}
            </Box>
          )}
          {playerId && state && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" sx={{ mb: 1 }}>
                Jugadores ({state.game.players.length}):
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" sx={{ mb: 2 }}>
                {state.game.players.map(p => (
                  <Box key={p.id} sx={{ position: 'relative', display: 'inline-flex' }}>
                    <Chip 
                      label={p.name} 
                      color={p.id === playerId ? 'primary' : 'default'} 
                      sx={{ fontSize: 16, px: 1.5, mb: 0.5 }} 
                    />
                    {state.isHost && p.id !== playerId && (
                      <Button
                        size="small"
                        onClick={() => kickPlayer(p.id, p.name)}
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          minWidth: 20,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          bgcolor: '#f44336',
                          color: 'white',
                          fontSize: 16,
                          fontWeight: 'bold',
                          p: 0,
                          '&:hover': {
                            bgcolor: '#d32f2f'
                          },
                          zIndex: 1
                        }}
                      >
                        ×
                      </Button>
                    )}
                  </Box>
                ))}
              </Stack>
              
              {/* Turn indicator - appears after word reading time */}
              {isRoundActive && state.currentTurnPlayer && !wordRevealing && showTurnInfo && (
                <Box sx={{ 
                  mb: 2, 
                  p: 2, 
                  bgcolor: '#e8f5e8', 
                  borderRadius: 2, 
                  border: '2px solid #4caf50',
                  animation: 'slideInFromTop 0.8s ease-out both',
                  '@keyframes slideInFromTop': {
                    '0%': {
                      opacity: 0,
                      transform: 'translateY(-30px)',
                      maxHeight: '0px',
                      padding: '0 16px',
                      marginBottom: '0px'
                    },
                    '100%': {
                      opacity: 1,
                      transform: 'translateY(0)',
                      maxHeight: '200px',
                      padding: '16px',
                      marginBottom: '16px'
                    }
                  }
                }}>
                  <Typography variant="h6" sx={{ color: '#2e7d32', mb: 1, textAlign: 'center' }}>
                    🎯 Turno de: <strong>{state.currentTurnPlayer.name}</strong>
                  </Typography>
                  {state.isMyTurn && (
                    <Typography variant="body2" sx={{ color: '#2e7d32', textAlign: 'center', fontWeight: 'bold' }}>
                      ¡Es tu turno!
                    </Typography>
                  )}
                </Box>
              )}
              
              {/* Next turn controls - appear after turn info */}
              {isRoundActive && (state.isMyTurn || state.isHost) && !wordRevealing && showControls && (
                <Box sx={{ 
                  mb: 2, 
                  display: 'flex', 
                  justifyContent: 'center',
                  gap: 2,
                  animation: 'slideInFromTop 0.6s ease-out both',
                  '@keyframes slideInFromTop': {
                    '0%': {
                      opacity: 0,
                      transform: 'translateY(-20px)',
                      maxHeight: '0px',
                      marginBottom: '0px'
                    },
                    '100%': {
                      opacity: 1,
                      transform: 'translateY(0)',
                      maxHeight: '100px',
                      marginBottom: '16px'
                    }
                  }
                }}>
                  {state.isHost && (
                    <Button 
                      variant="contained" 
                      color="primary" 
                      size="large" 
                      sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3 }}
                      onClick={nextRound}
                    >
                      🔄 Siguiente palabra
                    </Button>
                  )}
                  <Button 
                    variant="contained" 
                    color="success" 
                    size="large" 
                    sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3 }}
                    onClick={nextTurn}
                  >
                    👉 Siguiente jugador
                  </Button>
                </Box>
              )}
              
              <Divider sx={{ my: 2 }} />

              {state.isHost && !isRoundActive && playerId && (
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 2 }}>
                  <Button variant="contained" color="primary" size="large" sx={{ fontSize: 18, px: 3, py: 1.2, borderRadius: 3 }} onClick={startRound} disabled={state.game.players.length<3}>
                    🎯 Iniciar
                  </Button>
                </Stack>
              )}
              {isRoundActive && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, color: '#1976d2' }}>🎯 Tu palabra:</Typography>
                  <Box sx={{ 
                    position: 'relative',
                    p: 2, 
                    border: '2px dashed', 
                    borderColor: '#1976d2', 
                    borderRadius: 2, 
                    bgcolor: '#e3f2fd', 
                    fontSize: 22, 
                    fontWeight: 'bold', 
                    letterSpacing: 1, 
                    textTransform: 'uppercase',
                    minHeight: 60,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {/* Categoría en esquina inferior derecha - solo visible cuando no hay countdown */}
                    {categoryInfo && !wordRevealing && (
                      <Box sx={{ 
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        fontSize: 10,
                        fontWeight: 500,
                        color: '#e65100',
                        bgcolor: '#fff3e0',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        border: '1px solid #ffb74d',
                        textTransform: 'none',
                        letterSpacing: 0
                      }}>
                        {categoryInfo.name}
                      </Box>
                    )}
                    {wordRevealing ? (
                      // Contador y animación de revelado
                      <Box sx={{ 
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {countdown > 0 ? (
                          <Typography sx={{ 
                            fontSize: 28, 
                            fontWeight: 'bold', 
                            color: '#1976d2',
                            animation: 'pulse 1s infinite'
                          }}>
                            {countdown}
                          </Typography>
                        ) : (
                          <Box sx={{
                            position: 'relative',
                            width: '100%',
                            animation: 'slideDown 0.5s ease-out',
                            '@keyframes slideDown': {
                              '0%': {
                                transform: 'translateY(-100%)',
                                opacity: 0
                              },
                              '100%': {
                                transform: 'translateY(0)',
                                opacity: 1
                              }
                            },
                            '@keyframes pulse': {
                              '0%, 100%': {
                                transform: 'scale(1)',
                                opacity: 1
                              },
                              '50%': {
                                transform: 'scale(1.1)',
                                opacity: 0.8
                              }
                            }
                          }}>
                            {wordVisible === 'Eres el IMPOSTOR' ? '🎭 Eres el IMPOSTOR' : wordVisible ?? '...'}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      // Palabra visible normalmente
                      <Box sx={{ width: '100%', textAlign: 'center' }}>
                        {wordVisible === 'Eres el IMPOSTOR' ? '🎭 Eres el IMPOSTOR' : wordVisible ?? '...'}
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
              
              {/* Host controls: Abandonar partida y Finalizar juego */}
              {isRoundActive && state?.isHost && (
                <Box sx={{ 
                  mt: 3,
                  display: 'flex', 
                  justifyContent: 'center',
                  gap: 2
                }}>
                  <Button 
                    variant="outlined" 
                    color="error" 
                    size="large" 
                    sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3, bgcolor: '#ffeaea' }}
                    onClick={leaveGame}
                  >
                    🚪 Abandonar
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    size="large" 
                    sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3, bgcolor: '#f5f5f5' }}
                    onClick={closeGame}
                  >
                    🏁 Finalizar
                  </Button>
                </Box>
              )}
              
              {/* Host controls for inactive rounds: Abandonar partida y Finalizar juego */}
              {!isRoundActive && state?.isHost && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Button 
                    variant="outlined" 
                    color="error" 
                    size="large" 
                    sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3, bgcolor: '#ffeaea' }}
                    onClick={leaveGame}
                  >
                    🚪 Abandonar
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    size="large" 
                    sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3, bgcolor: '#f5f5f5' }}
                    onClick={closeGame}
                  >
                    🏁 Finalizar
                  </Button>
                </Box>
              )}
              
              {/* Abandonar partida button for non-host players */}
              {!state?.isHost && playerId && (
                <Box sx={{ mt: isRoundActive ? 3 : 2, display: 'flex', justifyContent: 'center' }}>
                  <Button 
                    variant="outlined" 
                    color="error" 
                    size="large" 
                    sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3, bgcolor: '#ffeaea' }}
                    onClick={leaveGame}
                  >
                    🚪 Abandonar
                  </Button>
                </Box>
              )}
              
              {!isRoundActive && playerId && <Typography sx={{ color: '#616161', mt: 2 }}>Esperando que el host inicie la ronda...</Typography>}
            </Box>
          )}
          {state && state.isHost && (
            <Typography sx={{ color: '#757575', mt: 3, fontSize: 15 }}>
              👑 Como host: comparte este link con los demás para que se unan.
            </Typography>
          )}
        </Card>
        <Card sx={{ maxWidth: 430, width: '100%', p: { xs: 2, sm: 3 }, boxShadow: 2, textAlign: 'left', bgcolor: '#fff', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#e64a19', mb: 1 }}>
            Reglas rápidas
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="El host inicia rondas. Cada ronda: palabra para todos menos el impostor." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Cada palabra rota el orden: quien empezaba pasa al final." />
            </ListItem>
            <ListItem>
              <ListItemText primary="El jugador activo (y el host) pueden pasar al siguiente turno." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Conversen y traten de descubrir al impostor." />
            </ListItem>
          </List>
        </Card>
      </Box>
  );
}
