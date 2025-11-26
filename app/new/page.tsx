"use client";
import { useState, useEffect } from 'react';
import Pusher from 'pusher-js';
import { Box, Button, Card, Typography, TextField, FormControlLabel, Checkbox, FormGroup, Divider, Stack } from '@mui/material';
import { WORD_CATEGORIES } from '../../lib/words';
import { PlayerSession } from '../../lib/player-session';

const CATEGORY_INFO = {
  animales: { name: '🐾 Animales', emoji: '🐾' },
  comidas: { name: '🍕 Comidas', emoji: '🍕' },
  lugares: { name: '🏖️ Lugares', emoji: '🏖️' },
  deportes: { name: '⚽ Deportes', emoji: '⚽' },
  tecnologia: { name: '💻 Tecnología', emoji: '💻' },
  musica: { name: '🎵 Música', emoji: '🎵' },
  objetos: { name: '🏠 Objetos', emoji: '🏠' },
  otros: { name: '✨ Otros', emoji: '✨' }
};

export default function NewGamePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<{ code: string; playerId: string } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>(
    Object.keys(CATEGORY_INFO).reduce((acc, cat) => ({ ...acc, [cat]: true }), {})
  );
  const [shareCategories, setShareCategories] = useState(true);
  const [allowAllKick, setAllowAllKick] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [hostName, setHostName] = useState('');

  useEffect(() => {
    const savedName = PlayerSession.getLastPlayerName() || '';
    setHostName(savedName);    
  }, []);
  
  useEffect(() => {
    let cancelled = false;
    const checkExistingGame = async () => {
      try {
        const playerId = PlayerSession.getPlayerId();
        if (!playerId) return;
        const res = await fetch(`/api/player/${playerId}/status`);
        if (res.ok) {
          const status = await res.json();
          if (status.inGame && status.currentGameCode) {
            if (!cancelled) {
              setActiveGame({
                code: status.currentGameCode,
                playerId
              });
            }
          } else if (!cancelled) {
            setActiveGame(null);
          }
        } else if (!cancelled) {
          setActiveGame(null);
        }
      } catch (err) {
        console.error('Error checking active game:', err);
        if (!cancelled) setActiveGame(null);
      }
    };
    checkExistingGame();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkExistingGame();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Poll para detectar cambios en partida activa desde otras pestañas
  useEffect(() => {
    let cancelled = false;
    const refreshStatus = async () => {
      try {
        const playerId = PlayerSession.getPlayerId();
        if (!playerId) return;
        const res = await fetch(`/api/player/${playerId}/status`);
        if (!res.ok) return;
        const status = await res.json();
        if (status.inGame && status.currentGameCode && !cancelled) {
          setActiveGame({ code: status.currentGameCode, playerId });
        } else if (!cancelled) {
          setActiveGame(null);
        }
      } catch (err) {
        // ignore
      }
    };
    const id = setInterval(refreshStatus, 5000);
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
        console.warn('[Pusher] Auth 403 on new banner, clearing activeGame');
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

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const name = hostName.trim();
    const wordsRaw = String(fd.get('words')||'').trim();

    if (!name) {
      window.location.href = '/';
      return;
    }
    
    const customWords = wordsRaw
      ? wordsRaw.split(/[,\n]/).map(w => w.trim()).filter(w => w.length > 0)
      : [];

    const selectedCats = Object.keys(selectedCategories).filter(cat => selectedCategories[cat]);
    const categoryWords: string[] = [];
    for (const cat of selectedCats) {
      if (WORD_CATEGORIES[cat as keyof typeof WORD_CATEGORIES]) {
        categoryWords.push(...WORD_CATEGORIES[cat as keyof typeof WORD_CATEGORIES]);
      }
    }

    const words = [...categoryWords, ...customWords];

    if (words.length === 0) {
      setError('Debe seleccionar al menos una categoría o escribir palabras');
      setLoading(false);
      return;
    }
    
    try {
      const playerId = PlayerSession.getPlayerId();
      
      // Check and leave any active game first
      try {
        const statusRes = await fetch(`/api/player/${playerId}/status`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.inGame && status.currentGameCode) {
            await fetch(`/api/game/${status.currentGameCode}/leave`, {
              method: 'POST',
              body: JSON.stringify({ playerId: playerId })
            });
          }
        }
      } catch (leaveError) {
        console.warn('Error leaving previous game:', leaveError);
      }
      
      // Save player name for future sessions
      PlayerSession.savePlayerName(name);
      
      const res = await fetch('/api/game', { 
        method: 'POST', 
        body: JSON.stringify({ 
          hostPlayerId: playerId,
          hostName: name, 
          words, 
          shareCategories,
          allowAllKick,
          isPublic
        }) 
      });
      if (!res.ok) throw new Error('Error creando partida');
      const data = await res.json();
      // Navigate directly without pid parameter to avoid redirect
      window.location.href = `/game/${data.code}`;
    } catch (err:any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fbe9e7', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box component="form" onSubmit={handleCreate} sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Stack spacing={2} sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
          {activeGame && (
            <Card sx={{ maxWidth: 520, p: 3, boxShadow: 4, textAlign: 'center', bgcolor: '#e8f5e8', border: '2px solid #4caf50' }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2e7d32', mb: 1 }}>
                🎯 Partida en curso
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, color: '#2e7d32' }}>
                Tienes una partida activa: <strong>{activeGame.code}</strong>
              </Typography>
              <Button 
                variant="contained" 
                color="success"
                size="large" 
                sx={{ fontSize: 18, px: 4, py: 1.5, borderRadius: 3, fontWeight: 600, width: '100%' }}
                onClick={() => {
                  window.location.href = `/game/${activeGame.code}`;
                }}
              >
                🚀 Continuar partida
              </Button>
            </Card>
          )}
          <Card
            sx={{
              p: { xs: 2, sm: 3 },
              boxShadow: 4,
              textAlign: 'center',
              bgcolor: '#ffccbc',
              color: 'inherit'
            }}
          >
            <Typography variant="h3" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
              🎲 Crear
            </Typography>
            <Typography sx={{ fontSize: 16 }}>
              Arma la sala, elige categorías o escribe tus propias palabras y comparte el código
            </Typography>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              size="large" 
              disabled={loading}
              sx={{ 
                fontSize: 18, 
                px: 4, 
                py: 1.5, 
                bgcolor: '#1e88e5', 
                borderRadius: 3,
                fontWeight: 700,
                mt: 2,
                width: '100%'
              }}
            >
              {loading ? '⏳ Creando...' : '🚀 Crear partida'}
            </Button>
          </Card>

          <Card sx={{ p: { xs: 2, sm: 3 }, boxShadow: 4, bgcolor: '#ffccbc' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
              ⚙️ Opciones
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={shareCategories}
                    onChange={(e) => setShareCategories(e.target.checked)}
                    sx={{ color: '#1976d2', '& .MuiSvgIcon-root': { fontSize: 26 } }}
                  />
                }
                label="Compartir categoría con el impostor"
                sx={{ fontSize: 14, margin: 0 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allowAllKick}
                    onChange={(e) => setAllowAllKick(e.target.checked)}
                    sx={{ color: '#1976d2', '& .MuiSvgIcon-root': { fontSize: 26 } }}
                  />
                }
                label="Todos pueden expulsar"
                sx={{ fontSize: 14, margin: 0 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    sx={{ color: '#1976d2', '& .MuiSvgIcon-root': { fontSize: 26 } }}
                  />
                }
                label="Sala pública"
                sx={{ fontSize: 14, margin: 0 }}
              />
            </FormGroup>
          </Card>

          <Card sx={{ p: { xs: 2, sm: 3 }, boxShadow: 4, bgcolor: '#ffccbc' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
              🗂️ Categorías
            </Typography>
            <FormGroup sx={{ mt: 1 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  columnGap: 1.5,
                  rowGap: 0.4
                }}
              >
                {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        checked={selectedCategories[key]}
                        onChange={() => handleCategoryChange(key)}
                        sx={{ color: '#1976d2', '& .MuiSvgIcon-root': { fontSize: 26 } }}
                      />
                    }
                    label={
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0, ml: -0.6 }}>
                        <Typography component="span" sx={{ fontSize: 24, lineHeight: 1, mr: 0 }}>
                          {info.emoji}
                        </Typography>
                        <Typography component="span" sx={{ fontSize: 14, lineHeight: 1.1 }}>
                          {info.name.replace(/^[^\s]+\s*/, '')}
                        </Typography>
                      </Box>
                    }
                    sx={{ 
                      fontSize: 16, 
                      margin: 0,
                      '& .MuiFormControlLabel-label': { 
                        fontSize: 16,
                        marginLeft: 0.5
                      }
                    }}
                  />
                ))}
              </Box>
            </FormGroup>
          </Card>

          <Card sx={{ p: { xs: 2, sm: 3 }, boxShadow: 4, bgcolor: '#ffccbc' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
              📝 Agregar palabras
            </Typography>
            <TextField 
              name="words" 
              label="Palabras" 
              placeholder="Separadas por coma o líneas" 
              multiline 
              rows={4} 
              variant="outlined"
              fullWidth
              sx={{ bgcolor: '#fff', borderRadius: 1, mb: 1 }}
            />
            <Typography sx={{ color: '#666', fontSize: 12 }}>
              Ejemplos: &quot;gato, perro, pájaro&quot; o una por línea. Se mezclarán con las categorías seleccionadas.
            </Typography>
          </Card>

          {error && (
            <Typography color="error" sx={{ fontSize: 16, fontWeight: 500 }}>
              {error}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
