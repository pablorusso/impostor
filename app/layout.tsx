import './globals.css';
import type { ReactNode } from 'react';
import HeaderNav from './components/HeaderNav';
import { ConnectionProvider } from './contexts/ConnectionContext';

export const metadata = {
  title: 'Impostor Game',
  description: 'Juego de palabras tipo impostor para jugar en persona',
  manifest: '/manifest.json',
  appleWebApp: {
    title: 'Impostor Game',
    statusBarStyle: 'default',
    capable: true,
  },
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
  themeColor: '#e64a19',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#e64a19" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Impostor Game" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" sizes="192x192" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Impostor Game" />
        <meta name="msapplication-TileColor" content="#e64a19" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                      console.log('[SW] Registration successful:', registration.scope);
                    })
                    .catch((error) => {
                      console.log('[SW] Registration failed:', error);
                    });
                });
              }
            `
          }}
        />
      </head>
      <body style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', backgroundColor:'#fbe9e7', margin:0, minHeight:'100vh'}}>
        <ConnectionProvider>
          <header style={{padding:'0.75rem 1rem',borderBottom:'1px solid #ddd',marginBottom:'1rem',background:'#ffccbc', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <HeaderNav />
          </header>
          <main style={{maxWidth:840,margin:'0 auto',padding:'0 1rem'}}>{children}</main>
        </ConnectionProvider>
      </body>
    </html>
  );
}
