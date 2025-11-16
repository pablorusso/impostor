"use client";
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { Box, Button, Card, Typography, TextField } from '@mui/material';
import { PlayerSession } from '../lib/player-session';

export default function HomePage() {
  const [checking, setChecking] = useState(true);
  const [activeGame, setActiveGame] = useState<{ code: string; playerId: string } | null>(null);

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
    
    checkActiveGame();
  }, []);

  // Show loading while checking for active games
  if (checking) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#fbe9e7', p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Card sx={{ maxWidth: 400, width: '100%', p: 3, boxShadow: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#e64a19', mb: 2 }}>
            🔍 Verificando partidas activas...
          </Typography>
          <Typography variant="body1" sx={{ color: '#757575' }}>
            Comprobando si tienes una partida en curso
          </Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fbe9e7', p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Continue active game option */}
      {activeGame && (
        <Suspense>
          <ContinueGame gameCode={activeGame.code} playerId={activeGame.playerId} />
        </Suspense>
      )}
      
      <Card sx={{ maxWidth: 400, width: '100%', mb: 2, p: 3, boxShadow: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
          🎭 Impostor
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Juego social presencial: crea una partida, comparte el código y reparte palabras. Uno es el impostor y no recibe la palabra.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <CreateNewGameButton activeGame={activeGame} />
        </Box>
      </Card>
      <Suspense>
        <JoinExisting activeGame={activeGame} />
      </Suspense>
    </Box>
  );
}

function ContinueGame({ gameCode, playerId }: { gameCode: string; playerId: string }) {
  return (
    <Card sx={{ maxWidth: 400, width: '100%', mb: 2, p: 3, boxShadow: 4, textAlign: 'center', bgcolor: '#e8f5e8', border: '2px solid #4caf50' }}>
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
          window.location.href = `/game/${gameCode}?pid=${playerId}`;
        }}
      >
        🚀 Continuar partida
      </Button>
    </Card>
  );
}

function CreateNewGameButton({ activeGame }: { activeGame: { code: string; playerId: string } | null }) {
  const [loading, setLoading] = useState(false);

  const handleCreateNew = async () => {
    if (activeGame) {
      setLoading(true);
      try {
        // Leave current game first
        await fetch(`/api/game/${activeGame.code}/leave`, {
          method: 'POST',
          body: JSON.stringify({ playerId: activeGame.playerId })
        });
      } catch (error) {
        console.error('Error leaving current game:', error);
      }
      setLoading(false);
    }
    window.location.href = '/new';
  };

  if (activeGame) {
    return (
      <Button 
        variant="outlined" 
        color="primary" 
        size="large" 
        disabled={loading}
        sx={{ fontSize: 18, px: 4, py: 1.5, borderRadius: 3 }}
        onClick={handleCreateNew}
      >
        {loading ? '⏳ Saliendo...' : '🎮 Crear nueva partida'}
      </Button>
    );
  }

  return (
    <Link href="/new" passHref legacyBehavior>
      <Button variant="contained" color="primary" size="large" sx={{ fontSize: 20, px: 4, py: 1.5, bgcolor: '#1e88e5', borderRadius: 3 }}>
        🎮 Crear nueva partida
      </Button>
    </Link>
  );
}

function JoinExisting({ activeGame }: { activeGame: { code: string; playerId: string } | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const form = e.currentTarget as HTMLFormElement;
    const code = (form.code as HTMLInputElement).value.trim().toUpperCase();
    if (!code) {
      setLoading(false);
      return;
    }

    try {
      // If user has an active game, leave it first
      if (activeGame) {
        if (activeGame.code === code) {
          // Same game, redirect directly
          window.location.href = `/game/${code}?pid=${activeGame.playerId}`;
          return;
        } else {
          // Different game, leave current one first
          await fetch(`/api/game/${activeGame.code}/leave`, {
            method: 'POST',
            body: JSON.stringify({ playerId: activeGame.playerId })
          });
        }
      }
      
      // Proceed to join new game
      window.location.href = `/game/${code}`;
    } catch (err) {
      console.error('Error joining game:', err);
      setError('Error al unirse a la partida. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 400, width: '100%', p: 3, boxShadow: 2, textAlign: 'center', bgcolor: '#fff' }}>
      <Typography variant="h5" sx={{ fontWeight: 600, color: '#1976d2', mb: 2 }}>
        🚪 Unirse a partida
      </Typography>
      <Box component="form" onSubmit={handleJoin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField name="code" label="Código" inputProps={{ maxLength: 8 }} required variant="outlined" sx={{ mb: 1 }} />
        <Button 
          type="submit" 
          variant="contained" 
          color="primary" 
          size="large" 
          disabled={loading}
          sx={{ fontSize: 18, px: 3, py: 1.2, bgcolor: '#1e88e5', borderRadius: 3 }}
        >
          {loading ? '🔍 Verificando...' : '🎯 Ir al lobby'}
        </Button>
        {error && (
          <Typography color="error" sx={{ fontSize: 14, mt: 1 }}>
            {error}
          </Typography>
        )}
      </Box>
    </Card>
  );
}
