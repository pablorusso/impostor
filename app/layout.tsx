import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Impostor Game',
  description: 'Juego de palabras tipo impostor para jugar en persona',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', backgroundColor:'#fbe9e7', margin:0}}>
        <header style={{padding:'0.75rem 1rem',borderBottom:'1px solid #ddd',marginBottom:'1rem',background:'#ffccbc'}}>
          <strong style={{color:'#e64a19',fontSize:'1.3rem'}}>Impostor</strong>
        </header>
        <main style={{maxWidth:840,margin:'0 auto',padding:'0 1rem'}}>{children}</main>
        <footer style={{textAlign:'center',padding:'2rem 0',fontSize:'0.8rem',color:'#666'}}>Hecho para jugar presencialmente · Estado en memoria (no persistente)</footer>
      </body>
    </html>
  );
}
