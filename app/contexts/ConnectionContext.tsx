'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'error';

interface ConnectionContextType {
  connectionStatus: ConnectionStatus;
  retryCount: number;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setRetryCount: (count: number | ((prev: number) => number)) => void;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [retryCount, setRetryCount] = useState(0);

  return (
    <ConnectionContext.Provider value={{
      connectionStatus,
      retryCount,
      setConnectionStatus,
      setRetryCount,
    }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  return context; // Puede ser null si no está en contexto de juego
}