"use client";
import { useState } from 'react';

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
    <div className="card">
      <h1>Nueva partida</h1>
      <form onSubmit={handleCreate}>
        <input name="name" placeholder="Tu nombre (host)" required maxLength={30} />
        <textarea name="words" placeholder="Lista de palabras (opcional, separadas por coma o líneas)" rows={5} />
        <button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear partida'}</button>
        {error && <p className="danger">{error}</p>}
        <p className="muted">Si no defines palabras se usan un conjunto por defecto.</p>
      </form>
    </div>
  );
}
