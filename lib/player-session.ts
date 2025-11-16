import { nanoid } from 'nanoid';

// Sistema de PlayerID persistente en el browser
export class PlayerSession {
  private static readonly PLAYER_ID_KEY = 'impostor_player_id';
  private static readonly PLAYER_NAME_KEY = 'impostor_player_name';
  
  // Obtener o crear PlayerID único para este browser
  static getPlayerId(): string {
    if (typeof window === 'undefined') {
      // En servidor, generar uno temporal
      return nanoid();
    }
    
    try {
      let playerId = localStorage.getItem(this.PLAYER_ID_KEY);
      if (!playerId) {
        playerId = nanoid();
        localStorage.setItem(this.PLAYER_ID_KEY, playerId);
        console.log('[PlayerSession] Created new PlayerID:', playerId);
      }
      return playerId;
    } catch (error) {
      console.warn('[PlayerSession] localStorage not available:', error);
      return nanoid();
    }
  }
  
  // Guardar nombre del jugador para autocompletar
  static savePlayerName(name: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.PLAYER_NAME_KEY, name.trim());
    } catch (error) {
      console.warn('[PlayerSession] Could not save player name:', error);
    }
  }
  
  // Obtener último nombre usado
  static getLastPlayerName(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      return localStorage.getItem(this.PLAYER_NAME_KEY);
    } catch (error) {
      console.warn('[PlayerSession] Could not get player name:', error);
      return null;
    }
  }
  
  // Limpiar sesión (útil para testing)
  static clearSession(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(this.PLAYER_ID_KEY);
      localStorage.removeItem(this.PLAYER_NAME_KEY);
      console.log('[PlayerSession] Session cleared');
    } catch (error) {
      console.warn('[PlayerSession] Could not clear session:', error);
    }
  }
}