'use client';

import Link from 'next/link';

export default function HeaderNav() {
  return (
    <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
      <Link href="/" style={{textDecoration:'none', color:'#e64a19', display:'flex', alignItems:'center', padding:'0.25rem', borderRadius:'4px'}} 
            title="Volver a inicio"
            className="home-btn">
        🏠
      </Link>
      <strong style={{color:'#e64a19',fontSize:'1.3rem'}}>Impostor</strong>
    </div>
  );
}