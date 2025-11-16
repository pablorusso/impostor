'use client';

import Link from 'next/link';
import { useConnection } from '../contexts/ConnectionContext';

export default function HeaderNav() {
  const { connectionStatus, retryCount } = useConnection();
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%'}}>
      <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
        <Link href="/" style={{textDecoration:'none', color:'#e64a19', display:'flex', alignItems:'center', padding:'0.25rem', borderRadius:'4px'}} 
              title="Volver a inicio"
              className="home-btn">
          🏠
        </Link>
        <strong style={{color:'#e64a19',fontSize:'1.3rem'}}>Impostor</strong>
      </div>
      
      {/* Indicador de estado de conexión */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.25rem',
        fontSize: '12px',
        color: connectionStatus === 'connected' ? '#4caf50' : 
               connectionStatus === 'connecting' ? '#ff9800' : '#f44336'
      }}>
        {connectionStatus === 'connected' && '🟢'}
        {connectionStatus === 'connecting' && '🟡'}
        {connectionStatus === 'error' && '🔴'}
        <span style={{ fontSize: '10px', fontWeight: 500 }}>
          {connectionStatus === 'connected' && 'Conectado'}
          {connectionStatus === 'connecting' && 'Conectando...'}
          {connectionStatus === 'error' && `Error (${retryCount}/10)`}
        </span>
      </div>
    </div>
  );
}