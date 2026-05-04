import type { Player } from "./game";

export type AppMode = "local" | "host" | "join";
export type LobbyStatus = "waiting" | "ready" | "in-game";

export interface LobbyPlayer {
  clientId: string;
  playerId: string;
  name: string;
  color: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
}

export interface LobbyState {
  lobbyId: string;
  mode: AppMode;
  hostClientId: string;
  maxPlayers: 2 | 3 | 4;
  players: LobbyPlayer[];
  status: LobbyStatus;
  selectedSessionId?: string;
  selectedDeckTemplateIds: string[];
}

export const lobbyPlayerToGamePlayer = (player: LobbyPlayer): Player => ({
  id: player.playerId,
  name: player.name,
  color: player.color,
  handCardInstanceIds: []
});
