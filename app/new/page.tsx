"use client";
import { useState } from 'react';
import { Box, Button, Card, Typography, TextField } from '@mui/material';

export default function NewGamePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name')||'').trim();
    const wordsRaw = String(fd.get('words')||'').trim();
    const words = wordsRaw.split(/[,\n]/).map(w => w.trim()).filter(w => w.length>0);
    try {
      const res = await fetch('/api/game', { method: 'POST', body: JSON.stringify({ hostName: name, words }) });
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
            inputProps={{ maxLength: 30 }} 
            variant="outlined" 
            size="medium"
            sx={{ bgcolor: '#fff', borderRadius: 1 }}
          />
          <TextField 
            name="words" 
            label="Lista de palabras (opcional)" 
            placeholder="Separadas por coma o líneas" 
            multiline 
            rows={5} 
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
            Si no defines palabras se usan un conjunto por defecto.
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}
