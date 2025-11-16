"use client";
import Link from 'next/link';
import { Suspense } from 'react';
import { Box, Button, Card, Typography, TextField } from '@mui/material';

export default function HomePage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fbe9e7', p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Card sx={{ maxWidth: 400, width: '100%', mb: 2, p: 3, boxShadow: 4, textAlign: 'center', bgcolor: '#ffccbc' }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#e64a19', mb: 1 }}>
          🎭 Impostor
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Juego social presencial: crea una partida, comparte el código y reparte palabras. Uno es el impostor y no recibe la palabra.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Link href="/new" passHref legacyBehavior>
            <Button variant="contained" color="primary" size="large" sx={{ fontSize: 20, px: 4, py: 1.5, bgcolor: '#1e88e5', borderRadius: 3 }}>
              🎮 Crear nueva partida
            </Button>
          </Link>
        </Box>
      </Card>
      <Suspense>
        <JoinExisting />
      </Suspense>
    </Box>
  );
}

function JoinExisting() {
  return (
    <Card sx={{ maxWidth: 400, width: '100%', p: 3, boxShadow: 2, textAlign: 'center', bgcolor: '#fff' }}>
      <Typography variant="h5" sx={{ fontWeight: 600, color: '#1976d2', mb: 2 }}>
        🚪 Unirse a partida
      </Typography>
      <Box component="form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget as HTMLFormElement;
          const code = (form.code as HTMLInputElement).value.trim().toUpperCase();
          if (!code) return;
          window.location.href = `/game/${code}`;
        }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField name="code" label="Código" inputProps={{ maxLength: 8 }} required variant="outlined" sx={{ mb: 1 }} />
        <Button type="submit" variant="contained" color="primary" size="large" sx={{ fontSize: 18, px: 3, py: 1.2, bgcolor: '#1e88e5', borderRadius: 3 }}>
          🎯 Ir al lobby
        </Button>
      </Box>
    </Card>
  );
}
