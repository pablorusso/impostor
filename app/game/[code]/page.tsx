"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { PlayerState } from '../../../lib/types';
import { Box, Button, Card, Typography, TextField, Chip, Stack, Divider, List, ListItem, ListItemText } from '@mui/material';
// Leer playerId sólo en cliente tras el montaje para evitar discrepancias SSR/CSR y errores de hidratación.
function readPlayerIdClient(): string | undefined {
  const pidParam = new URLSearchParams(window.location.search).get('pid');
  const stored = sessionStorage.getItem('playerId');
  return pidParam || stored || undefined;
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
  const [showEndGameButton, setShowEndGameButton] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) return;
    try {
      const res = await fetch(`/api/game/${code}/state?pid=${playerId}`);
      if (res.status === 404) {
        // Sala cerrada o no existe: limpiar completamente y redirigir a inicio.
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
        // Verificar que los datos del jugador sean consistentes
        if (data && data.player && data.player.name) {
          setState(data);
        } else {
          // Si los datos están corruptos, limpiar y recargar
          sessionStorage.clear();
          setPlayerId(undefined);
          setState(null);
          setName('');
          // Recargar la página para empezar limpio
          window.location.reload();
        }
      } else {
        // Error del servidor, limpiar sesión
        sessionStorage.clear();
        setPlayerId(undefined);
        setState(null);
        setName('');
      }
    } catch (error) {
      // Error de red, limpiar sesión
      sessionStorage.clear();
      setPlayerId(undefined);
      setState(null);
      setName('');
    }
  }, [playerId, code]);

  // Inicializar playerId tras montaje.
  useEffect(() => {
    if (playerId === undefined) {
      const pid = readPlayerIdClient();
      if (pid) {
        // Verificar que el playerId sea válido antes de usarlo
        fetch(`/api/game/${code}/state?pid=${pid}`)
          .then(res => {
            if (res.ok) {
              return res.json().then(data => {
                // Verificar que el jugador tenga nombre y esté correctamente registrado
                if (data && data.player && data.player.name) {
                  sessionStorage.setItem('playerId', pid);
                  setPlayerId(pid);
                } else {
                  // Si el jugador no tiene nombre o datos corruptos, limpiar todo
                  sessionStorage.clear();
                  setPlayerId(undefined);
                  setName('');
                }
              });
            } else {
              // Si el playerId no es válido, limpiar completamente
              sessionStorage.clear();
              setPlayerId(undefined);
              setName('');
            }
          })
          .catch(() => {
            // En caso de error de red, limpiar completamente
            sessionStorage.clear();
            setPlayerId(undefined);
            setName('');
          });
      }
    }
  }, [playerId, code]);

  // Suscripción SSE para eventos del juego (elimina polling continuo)
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!playerId) return; // esperar a tener jugador (para refresh personalizado)
    refresh(); // carga inicial
    const es = new EventSource(`/api/game/${code}/events`);
    sseRef.current = es;
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'ping') return; // heartbeat
        if (msg.type === 'game-close') {
          sessionStorage.removeItem('playerId');
          window.location.href = '/';
          return;
        }
        // Para cualquier evento relevante refrescar estado individual
        if ([
          'init',
          'player-join',
          'round-start',
          'round-next',
          'round-end',
          'next-turn'
        ].includes(msg.type)) {
          refresh();
        }
      } catch {}
    };
    es.onerror = () => {
      // Fallback simple: cerrar SSE (el usuario puede recargar)
      es.close();
    };
    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [code, playerId, refresh]);

  // Detectar nueva ronda e iniciar animación
  useEffect(() => {
    if (state?.round && state.round.id !== lastRoundId) {
      setLastRoundId(state.round.id);
      setWordRevealing(true);
      setCountdown(3);
      setShowTurnInfo(false);
      setShowControls(false);
      setShowEndGameButton(false);
      
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
        setShowEndGameButton(true); // Mostrar botón finalizar cuando aparece la palabra
      }, 500); // Pequeño delay para la animación final
    }
  }, [countdown, wordRevealing]);

  async function join() {
    setJoining(true); setError(null);
    try {
      // Limpiar sesión previa antes de unirse a nueva partida
      sessionStorage.clear();
      
      const res = await fetch(`/api/game/${code}/join`, { method: 'POST', body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error('No se pudo unir');
      const data = await res.json();
      
      // Verificar que la respuesta tenga los datos esperados
      if (data && data.playerId) {
        sessionStorage.setItem('playerId', data.playerId);
        setPlayerId(data.playerId);
        setName('');
        setTimeout(refresh, 300);
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (e:any) { 
      setError(e.message);
      // Limpiar en caso de error
      sessionStorage.clear();
      setPlayerId(undefined);
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

  const isRoundActive = !!state?.round;
  const wordVisible = isRoundActive ? (state?.wordForPlayer === null ? 'Eres el IMPOSTOR' : state?.wordForPlayer) : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fbe9e7', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Card sx={{ maxWidth: 430, width: '100%', mb: 2, p: { xs: 2, sm: 3 }, boxShadow: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
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
                  <Chip key={p.id} label={p.name} color={p.id === playerId ? 'primary' : 'default'} sx={{ fontSize: 16, px: 1.5, mb: 0.5 }} />
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
                    🎯 Iniciar juego
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
                            {wordVisible === 'Eres el IMPOSTOR' ? '🎭 ' + wordVisible : wordVisible ?? '...'}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      // Palabra visible normalmente
                          <Box sx={{ width: '100%', textAlign: 'center' }}>
                        {wordVisible === 'Eres el IMPOSTOR' ? '🎭 ' + wordVisible : wordVisible ?? '...'}
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
              
              {/* Finalizar juego button below word for host */}
              {isRoundActive && state?.isHost && showEndGameButton && (
                <Box sx={{ 
                  mt: 3,
                  display: 'flex', 
                  justifyContent: 'center'
                }}>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    size="large" 
                    sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3, bgcolor: '#f5f5f5' }}
                    onClick={closeGame}
                  >
                    🏁 Finalizar juego
                  </Button>
                </Box>
              )}
              
              {/* Finalizar juego button for inactive rounds */}
              {!isRoundActive && state?.isHost && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    size="large" 
                    sx={{ fontSize: 16, px: 3, py: 1.2, borderRadius: 3, bgcolor: '#f5f5f5' }}
                    onClick={closeGame}
                  >
                    🏁 Finalizar juego
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
              <ListItemText primary="Conversad y tratad de descubrir al impostor." />
            </ListItem>
          </List>
        </Card>
      </Box>
  );
}
