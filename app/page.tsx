"use client";
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { Box, Button, Card, Typography, TextField, Stack, Link as MuiLink } from '@mui/material';
import { PlayerSession } from '../lib/player-session';

export default function HomePage() {
  const [checking, setChecking] = useState(true);
  const [activeGame, setActiveGame] = useState<{ code: string; playerId: string } | null>(null);
  const [publicGames, setPublicGames] = useState<Array<{ code: string; host: string }>>([]);
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    // Check if player has an active game on page load
    const checkActiveGame = async () => {
      try {
        const playerId = PlayerSession.getPlayerId();
        const res = await fetch(`/api/player/${playerId}/status`);
        
        if (res.ok) {
          const status = await res.json();
          if (status.inGame && status.currentGameCode) {
            // Store active game info instead of auto-redirecting
            setActiveGame({
              code: status.currentGameCode,
              playerId: playerId
            });
          }
        }
      } catch (error) {
        console.error('Error checking active game:', error);
      } finally {
        setChecking(false);
      }
    };
    
    const lastName = PlayerSession.getLastPlayerName();
    if (lastName) setPlayerName(lastName);
    checkActiveGame();
  }, []);
  
  // Poll status to catch changes from other tabs/windows
  useEffect(() => {
    let cancelled = false;
    const refreshStatus = async () => {
      try {
        const playerId = PlayerSession.getPlayerId();
        if (!playerId) {
          if (!cancelled) setActiveGame(null);
          return;
        }
        const res = await fetch(`/api/player/${playerId}/status`);
        if (!res.ok) {
          if (!cancelled) setActiveGame(null);
          return;
        }
        const status = await res.json();
        if (status.inGame && status.currentGameCode) {
          if (!cancelled) setActiveGame({ code: status.currentGameCode, playerId });
        } else if (!cancelled) {
          setActiveGame(null);
        }
      } catch (err) {
        if (!cancelled) setActiveGame(null);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshStatus();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const id = setInterval(refreshStatus, 5000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(id);
    };
  }, []);

  // Public games polling
  useEffect(() => {
    let cancelled = false;
    const fetchPublic = async () => {
      try {
        const res = await fetch('/api/game/public');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPublicGames(data.games || []);
      } catch (err) {
        if (!cancelled) setPublicGames([]);
      }
    };
    fetchPublic();
    const id = setInterval(fetchPublic, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  
  useEffect(() => {
    if (!activeGame || !process.env.NEXT_PUBLIC_PUSHER_KEY) return;
    const { code, playerId } = activeGame;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: `/api/pusher/auth`,
      auth: {
        headers: { 'x-player-id': playerId },
      },
    });

    const channelName = `private-game-${code.toUpperCase()}`;
    const channel = pusher.subscribe(channelName);

    const handleSubscriptionError = (status: number) => {
      if (status === 403) {
        console.warn('[Pusher] Auth 403 on home banner, clearing activeGame');
        setActiveGame(null);
      }
    };

    const handlePlayerLeave = (data: any) => {
      if (data?.playerId && data.playerId === playerId) {
        setActiveGame(null);
      }
    };

    const handleGameClose = () => {
      setActiveGame(null);
    };

    channel.bind('player-leave', handlePlayerLeave);
    channel.bind('game-close', handleGameClose);
    channel.bind('pusher:subscription_error', handleSubscriptionError);

    return () => {
      channel.unbind('player-leave', handlePlayerLeave);
      channel.unbind('game-close', handleGameClose);
      channel.unbind('pusher:subscription_error', handleSubscriptionError);
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [activeGame]);

  // Show loading while checking for active games
  if (checking) {
    return (
      <Box sx={{ bgcolor: '#fbe9e7', p: { xs: 1, sm: 2 }, pb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { xs: '100%', sm: 440 }, mx: 'auto' }}>
          <Card sx={{ maxWidth: 520, p: 3, boxShadow: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#e64a19', mb: 2 }}>
              🔍 Buscando partidas...
            </Typography>
            <Typography variant="body1" sx={{ color: '#757575' }}>
              Comprobando si tienes una partida en curso
            </Typography>
          </Card>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#fbe9e7', p: { xs: 1, sm: 2 }, pb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Stack spacing={2} sx={{ width: '100%', maxWidth: { xs: '100%', sm: 440 }, mx: 'auto' }}>
        {/* Continue active game option */}
        {activeGame && (
          <Suspense>
            <ContinueGame gameCode={activeGame.code} playerId={activeGame.playerId} />
          </Suspense>
        )}
        
        <Card sx={{ maxWidth: 520, p: 3, boxShadow: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
          <Typography variant="h3" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
            🎭 Impostor
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Juego social presencial: crea una partida, comparte el código y reparte palabras. Uno es el impostor y no recibe la palabra.
          </Typography>
        </Card>
        
        <Card sx={{ maxWidth: 520, p: { xs: 2, sm: 3 }, boxShadow: 4, bgcolor: '#ffccbc' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1, flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
              👤 Tu nombre
            </Typography>
            <TextField
              name="Nombre"
              fullWidth
              value={playerName}
              onChange={(e) => {
                const val = e.target.value.slice(0, 30);
                setPlayerName(val);
                PlayerSession.savePlayerName(val);
                if (val.trim()) {
                  sessionStorage.setItem('playerName', val.trim());
                }
              }}
              inputProps={{ maxLength: 30 }}
              variant="outlined"
              size="medium"
              sx={{ bgcolor: '#fff', borderRadius: 1 }}
            />
          </Box>
        </Card>
        
        <Card sx={{ maxWidth: 520, p: { xs: 2, sm: 3 }, boxShadow: 4, bgcolor: '#ffccbc' }}>
          <Box sx={{ maxWidth: 520, bgcolor: '#ffccbc' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
              🎲 Partidas
            </Typography>
            <Box sx={{ maxWidth: 520, bgcolor: '#ffccbc', mt: 2, mb: 3 }}>
              <CreateNewGameButton activeGame={activeGame} />
            </Box>
          </Box>
          <Box sx={{ maxWidth: 520, bgcolor: '#ffccbc', mt: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
              🌐 Existente
            </Typography>
            <Stack spacing={1.5}>
              <Suspense>
                <JoinExisting activeGame={activeGame} playerName={playerName} />
              </Suspense>
              {publicGames
                .filter((g) => !activeGame || g.code !== activeGame.code)
                .map((g) => (
                <Box key={g.code} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f5f5f5', p: 1.2, borderRadius: 2 }}>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography sx={{ fontWeight: 700, color: '#e64a19' }}>{g.code}</Typography>
                    <Typography sx={{ fontSize: 13, color: '#616161' }}>Host: {g.host}</Typography>
                  </Box>
                  <MuiLink href={`/game/${g.code}`} underline="none">
                    <Button variant="contained" size="small" color="primary">
                      Unirse
                    </Button>
                  </MuiLink>
                </Box>
              ))}
            </Stack>
          </Box>
        </Card>
      </Stack>
    </Box>
  );
}

function ContinueGame({ gameCode, playerId }: { gameCode: string; playerId: string }) {
  return (
    <Card sx={{ maxWidth: 520, mb: 2, p: 3, boxShadow: 4, textAlign: 'center', bgcolor: '#e8f5e8', border: '2px solid #4caf50' }}>
      <Typography variant="h5" sx={{ fontWeight: 600, color: '#2e7d32', mb: 1 }}>
        🎯 Partida en curso
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: '#2e7d32' }}>
        Tienes una partida activa: <strong>{gameCode}</strong>
      </Typography>
      <Button 
        variant="contained" 
        color="success"
        size="large" 
        sx={{ fontSize: 18, px: 4, py: 1.5, borderRadius: 3, fontWeight: 600 }}
        onClick={() => {
          // Navigate directly without pid parameter to avoid redirect
          window.location.href = `/game/${gameCode}`;
        }}
      >
        🚀 Continuar partida
      </Button>
    </Card>
  );
}

function CreateNewGameButton({ activeGame }: { activeGame: { code: string; playerId: string } | null }) {
  const handleCreateNew = () => {
    window.location.href = '/new';
  };

  return (
    <Button 
      variant={activeGame ? 'outlined' : 'contained'} 
      color="primary" 
      size="large" 
      sx={{ fontSize: activeGame ? 18 : 20, px: 4, py: 1.5, borderRadius: 3, width: '100%', bgcolor: activeGame ? undefined : '#1e88e5' }}
      onClick={handleCreateNew}
    >
      🎮 Nueva partida
    </Button>
  );
}

function JoinExisting({ activeGame, playerName }: { activeGame: { code: string; playerId: string } | null; playerName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const CODE_MAX_LENGTH = 5;

  const extractCode = (input: string) => {
    const trimmed = input.trim().toUpperCase();
    const urlMatch = trimmed.match(/\/game\/([A-Z0-9]{4,8})/i);
    if (urlMatch && urlMatch[1]) return urlMatch[1].toUpperCase();
    const trailingMatch = trimmed.match(/([A-Z0-9]{4,8})$/i);
    if (trailingMatch && trailingMatch[1]) return trailingMatch[1].toUpperCase();
    const codeOnly = trimmed.match(/^[A-Z0-9]{4,8}$/i);
    return codeOnly ? codeOnly[0].toUpperCase() : '';
  };

  const handleJoin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const nameToUse = playerName.trim();
    if (!nameToUse) {
      setError('Ingresa tu nombre arriba antes de unirte');
      setLoading(false);
      return;
    }
    const code = extractCode(codeInput);
    if (!code) {
      setLoading(false);
      return;
    }

    try {
      const playerId = PlayerSession.getPlayerId();
      PlayerSession.savePlayerName(nameToUse);
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('playerName', nameToUse);

      // If user has an active game and it's different, leave it first
      if (activeGame && activeGame.code !== code) {
        await fetch(`/api/game/${activeGame.code}/leave`, {
          method: 'POST',
          body: JSON.stringify({ playerId: activeGame.playerId })
        });
      }

      // Join directly
      const res = await fetch(`/api/game/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, name: nameToUse })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo unir a la partida');
      }

      window.location.href = `/game/${code}`;
    } catch (err) {
      console.error('Error joining game:', err);
      setError(err instanceof Error ? err.message : 'Error al unirse a la partida. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleJoin} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f5f5f5', p: 1.2, borderRadius: 2 }}>
      <Box sx={{ textAlign: 'left' }}>
        <TextField
          name="code"
          required
          variant="outlined"
          placeholder='Código o link'
          value={codeInput}
          onChange={(e) => {
            const parsed = extractCode(e.target.value);
            if (parsed) {
              setCodeInput(parsed.slice(0, CODE_MAX_LENGTH));
              return;
            }
            setCodeInput(e.target.value.toUpperCase().slice(0, CODE_MAX_LENGTH));
          }}
          onBlur={() => {
            const parsed = extractCode(codeInput);
            if (parsed) setCodeInput(parsed.slice(0, CODE_MAX_LENGTH));
          }}
        />
      </Box>
      <MuiLink underline="none">
        <Button variant="contained" size="small" color="primary" type="submit" disabled={loading}>
          Unirse
        </Button>
      </MuiLink>
      {error && (
        <Typography color="error" sx={{ fontSize: 14, mt: 1 }}>
          {error}
        </Typography>
      )}
    </Box>);
}
