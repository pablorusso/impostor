"use client";
import { useState, useEffect } from 'react';
import { Box, Button, Card, Typography, TextField, FormControlLabel, Checkbox, FormGroup, Divider } from '@mui/material';
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
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>(
    Object.keys(CATEGORY_INFO).reduce((acc, cat) => ({ ...acc, [cat]: true }), {})
  );
  const [shareCategories, setShareCategories] = useState(true);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [defaultName, setDefaultName] = useState('');
  const [hostName, setHostName] = useState('');

  useEffect(() => {
    const session = new PlayerSession();
    setPlayerSession(session);
    const savedName = PlayerSession.getLastPlayerName() || '';
    setDefaultName(savedName);
    setHostName(savedName);
    
    // Check if player already has an active game
    const checkActiveGame = async () => {
      const playerId = PlayerSession.getPlayerId();
      try {
        const res = await fetch(`/api/player/${playerId}/status`);
        if (res.ok) {
          const status = await res.json();
          if (status.inGame && status.currentGameCode) {
            // Show info about current game but don't redirect automatically
            setError(`Nota: Actualmente tienes una partida activa (${status.currentGameCode}). Al crear una nueva serás automáticamente removido de la anterior.`);
          }
        }
      } catch (error) {
        console.error('Error checking player status:', error);
      }
    };
    
    checkActiveGame();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name')||'').trim();
    const wordsRaw = String(fd.get('words')||'').trim();
    
    let words: string[] = [];
    
    if (wordsRaw) {
      // Si el host escribió palabras personalizadas, usarlas
      words = wordsRaw.split(/[,\n]/).map(w => w.trim()).filter(w => w.length>0);
    } else {
      // Si no, usar las categorías seleccionadas
      const selectedCats = Object.keys(selectedCategories).filter(cat => selectedCategories[cat]);
      if (selectedCats.length === 0) {
        setError('Debe seleccionar al menos una categoría o escribir palabras personalizadas');
        setLoading(false);
        return;
      }
      
      for (const cat of selectedCats) {
        if (WORD_CATEGORIES[cat as keyof typeof WORD_CATEGORIES]) {
          words.push(...WORD_CATEGORIES[cat as keyof typeof WORD_CATEGORIES]);
        }
      }
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
          shareCategories 
        }) 
      });
      if (!res.ok) throw new Error('Error creando partida');
      const data = await res.json();
      const url = `/game/${data.code}?pid=${data.playerId}`;
      window.location.href = url;
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#fbe9e7', p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Card sx={{ maxWidth: 450, width: '100%', p: { xs: 2, sm: 3 }, boxShadow: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#e64a19', mb: 2 }}>
          🎲 Nueva partida
        </Typography>
        <Box component="form"
          onSubmit={handleCreate}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField 
            name="name" 
            label="Tu nombre (host)" 
            required 
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            inputProps={{ maxLength: 30 }} 
            variant="outlined" 
            size="medium"
            sx={{ bgcolor: '#fff', borderRadius: 1 }}
          />
          
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#1976d2' }}>
              📂 Categorías de palabras
            </Typography>
            <FormGroup sx={{ bgcolor: '#fff', p: 2, borderRadius: 1, border: '1px solid #ddd' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 0.5 }}>
                {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        checked={selectedCategories[key]}
                        onChange={() => handleCategoryChange(key)}
                        sx={{ color: '#1976d2', '& .MuiSvgIcon-root': { fontSize: 18 } }}
                      />
                    }
                    label={info.name}
                    sx={{ 
                      fontSize: 14, 
                      margin: 0,
                      '& .MuiFormControlLabel-label': { 
                        fontSize: 14,
                        marginLeft: 0.5
                      }
                    }}
                  />
                ))}
              </Box>
              <Typography sx={{ color: '#666', fontSize: 12, mt: 1 }}>
                Selecciona las categorías que quieres incluir en el juego
              </Typography>
            </FormGroup>
          </Box>
          
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="h6" sx={{ mb: 1, color: '#1976d2' }}>
              🔍 Opciones del impostor
            </Typography>
            <FormGroup sx={{ bgcolor: '#fff', p: 2, borderRadius: 1, border: '1px solid #ddd' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={shareCategories}
                    onChange={(e) => setShareCategories(e.target.checked)}
                    sx={{ color: '#1976d2' }}
                  />
                }
                label="Compartir categoría con el impostor"
                sx={{ fontSize: 14, margin: 0 }}
              />
              <Typography sx={{ color: '#666', fontSize: 12, mt: 1 }}>
                {shareCategories 
                  ? "✅ El impostor verá la categoría de la palabra (ej: 'Animales')"
                  : "❌ El impostor solo verá 'Eres el IMPOSTOR' sin más pistas"}
              </Typography>
            </FormGroup>
          </Box>
          
          <Divider sx={{ my: 1 }}>O</Divider>
          
          <TextField 
            name="words" 
            label="Palabras personalizadas (opcional)" 
            placeholder="Separadas por coma o líneas" 
            multiline 
            rows={4} 
            variant="outlined"
            sx={{ bgcolor: '#fff', borderRadius: 1 }}
          />
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
              mt: 1
            }}
          >
            {loading ? '⏳ Creando...' : '🚀 Crear partida'}
          </Button>
          {error && (
            <Typography color="error" sx={{ fontSize: 16, fontWeight: 500 }}>
              {error}
            </Typography>
          )}
          <Typography sx={{ color: '#757575', fontSize: 14, mt: 1 }}>
            💡 Puedes usar las categorías predefinidas o escribir tus propias palabras
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}
