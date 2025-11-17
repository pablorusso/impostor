'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeaderNav() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);

    // Verificar si ya está instalado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isInWebAppiOS);

    // Escuchar el evento beforeinstallprompt (solo funciona en Android/Chrome)
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

  const handleIOSInstallClick = () => {
    setShowIOSInstructions(!showIOSInstructions);
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
      
      {/* Botón de instalación PWA para Android/Chrome */}
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

      {/* Botón de instalación para iOS */}
      {isIOS && !isInstalled && !isInstallable && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={handleIOSInstallClick}
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
            title="Instrucciones para instalar en iOS"
          >
            🍎 Instalar
          </button>

          {/* Instrucciones para iOS */}
          {showIOSInstructions && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '0.5rem',
              background: 'white',
              border: '2px solid #e64a19',
              borderRadius: '8px',
              padding: '1rem',
              width: '280px',
              fontSize: '0.8rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000
            }}>
              <div style={{ color: '#e64a19', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                📱 Cómo instalar en iPhone:
              </div>
              <ol style={{ margin: 0, paddingLeft: '1rem', color: '#333' }}>
                <li>Toca el botón <strong>Compartir</strong> 📤</li>
                <li>Busca <strong>&quot;Agregar a pantalla de inicio&quot;</strong></li>
                <li>Toca <strong>&quot;Agregar&quot;</strong> ✅</li>
              </ol>
              <button
                onClick={() => setShowIOSInstructions(false)}
                style={{
                  background: '#e64a19',
                  border: 'none',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  marginTop: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
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