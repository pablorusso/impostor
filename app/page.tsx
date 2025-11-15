"use client";
import Link from 'next/link';
import { Suspense } from 'react';

export default function HomePage() {
  return (
    <div>
      <div className="card">
        <h1>Impostor</h1>
        <p>Juego social presencial: crea una partida, comparte el código y reparte palabras. Uno es el impostor y no recibe la palabra.</p>
        <div className="row">
          <Link href="/new"><button>Crear nueva partida</button></Link>
        </div>
      </div>
      <Suspense>
        <JoinExisting />
      </Suspense>
    </div>
  );
}

function JoinExisting() {
  return (
    <div className="card">
      <h2>Unirse a partida</h2>
      <form onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const code = (form.code as HTMLInputElement).value.trim().toUpperCase();
        if (!code) return;
        window.location.href = `/game/${code}`;
      }}>
        <input name="code" placeholder="Código" maxLength={8} required />
        <button type="submit">Ir al lobby</button>
      </form>
    </div>
  );
}
