export interface Player {
  id: string;
  name: string;
}

export interface Round {
  id: string;
  impostorId: string;
  word: string;
  startedAt: number;
  endedAt?: number;
}

export interface Game {
  code: string;
  hostId: string;
  players: Player[];
  words: string[];
  currentRound?: Round;
  turnOrder?: string[]; // Array of player IDs in turn order
  currentTurnIndex?: number; // Index into turnOrder
}

export interface PlayerState {
  isHost: boolean;
  game: Game;
  player?: Player;
  round?: Round;
  wordForPlayer?: string | null; // null -> impostor, string -> palabra, undefined -> no iniciada
  currentTurnPlayer?: Player; // Who's currently playing
  isMyTurn?: boolean; // Is it this player's turn?
}
