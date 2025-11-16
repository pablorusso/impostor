'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderNav() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isInWebAppiOS);

    // Escuchar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Escuchar cuando se instala la app
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installation accepted');
    } else {
      console.log('PWA installation dismissed');
    }
    
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

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
      
      {/* Botón de instalación PWA */}
      {isInstallable && !isInstalled && (
        <button
          onClick={handleInstallClick}
          style={{
            background: '#e64a19',
            border: 'none',
            color: 'white',
            padding: '0.5rem',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.85rem',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#d84315'}
          onMouseOut={(e) => e.currentTarget.style.background = '#e64a19'}
          title="Instalar aplicación en el dispositivo"
        >
          📱 Instalar
        </button>
      )}
      
      {/* Indicador de app instalada */}
      {isInstalled && (
        <div style={{
          color: '#4caf50',
          fontSize: '0.85rem',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          ✅ Instalada
        </div>
      )}
    </div>
  );
}