"use client";
import { useEffect, useState, useCallback } from 'react';
import { PlayerState } from '../../../lib/types';
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

  const refresh = useCallback(async () => {
    if (!playerId) return;
    const res = await fetch(`/api/game/${code}/state?pid=${playerId}`);
    if (res.status === 404) {
      // Sala cerrada: limpiar y redirigir a inicio.
      sessionStorage.removeItem('playerId');
      setState(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setState(data);
    }
  }, [playerId, code]);

  // Inicializar playerId tras montaje.
  useEffect(() => {
    if (playerId === undefined) {
      const pid = readPlayerIdClient();
      if (pid) {
        sessionStorage.setItem('playerId', pid);
        setPlayerId(pid);
      }
    }
  }, [playerId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, [refresh]);

  async function join() {
    setJoining(true); setError(null);
    try {
      const res = await fetch(`/api/game/${code}/join`, { method: 'POST', body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error('No se pudo unir');
      const data = await res.json();
      sessionStorage.setItem('playerId', data.playerId);
      setPlayerId(data.playerId);
      setName('');
      setTimeout(refresh, 300);
    } catch (e:any) { setError(e.message);} finally { setJoining(false); }
  }

  async function startRound() {
    await fetch(`/api/game/${code}/start-round`, { method: 'POST' });
    setTimeout(refresh, 300);
  }
  async function nextRound() {
    await fetch(`/api/game/${code}/next-round`, { method: 'POST' });
    setTimeout(refresh, 300);
  }
  async function closeGame() {
    const res = await fetch(`/api/game/${code}/close`, { method: 'POST' });
    if (res.ok) {
      sessionStorage.removeItem('playerId');
      window.location.href = '/';
    }
  }

  const isRoundActive = !!state?.round;
  const wordVisible = isRoundActive ? (state?.wordForPlayer === null ? 'Eres el IMPOSTOR' : state?.wordForPlayer) : null;

  return (
    <div>
      <div className="card">
        <h1>Partida {code}</h1>
        {!playerId && (
          <div>
            <h3>Unirte</h3>
            <div className="row" style={{marginBottom:'0.5rem'}}>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" maxLength={30} />
              <button disabled={!name || joining} onClick={join}>{joining?'Uniendo...':'Unirse'}</button>
            </div>
            {error && <p className="danger">{error}</p>}
          </div>
        )}
        {playerId && state && (
          <div>
            <p>Jugadores ({state.game.players.length}): {state.game.players.map(p=>p.name).join(', ')}</p>
            {state.isHost && isRoundActive && (
              <div className="row" style={{marginTop:'0.5rem'}}>
                <button onClick={nextRound}>Siguiente palabra</button>
                <button onClick={closeGame} style={{marginLeft:'auto',background:'#eee'}}>Finalizar juego</button>
              </div>
            )}
            {state.isHost && !isRoundActive && playerId && (
              <div className="row" style={{marginTop:'0.5rem'}}>
                <button onClick={startRound} disabled={state.game.players.length<3}>Iniciar juego</button>
                <button onClick={closeGame} style={{marginLeft:'auto',background:'#eee'}}>Finalizar juego</button>
              </div>
            )}
            {isRoundActive && (
              <div style={{marginTop:'1rem'}}>
                <div style={{padding:'1rem',border:'1px dashed #555',borderRadius:6,marginTop:'0.5rem',fontSize:'1.25rem',fontWeight:'bold'}}>
                  {wordVisible ?? '...'}
                </div>
              </div>
            )}
            {!isRoundActive && playerId && <p className="muted">Esperando que el host inicie la ronda...</p>}
          </div>
        )}
        {state && state.isHost && (
          <p className="muted" style={{marginTop:'1rem'}}>Como host: comparte este link con los demás para que se unan.</p>
        )}
      </div>
      <div className="card">
        <h2>Reglas rápidas</h2>
        <ul>
          <li>El host inicia rondas. Cada ronda: palabra para todos menos el impostor.</li>
          <li>Conversad presencialmente y tratad de descubrir al impostor.</li>
          <li>Cuando termine, el host finaliza y puede iniciar otra ronda.</li>
        </ul>
      </div>
    </div>
  );
}
