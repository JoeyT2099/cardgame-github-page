import type { AssetTemplate, DeckTemplate } from "./assets";
import type { GameSession } from "./game";
import type { LobbyState } from "./lobby";
import type { GameAction } from "../store/actions";

export type NetworkRole = "local" | "host" | "join";
export type NetworkStatus = "idle" | "signaling" | "connecting" | "connected" | "disconnected" | "error";

export type MultiplayerMessage =
  | { kind: "ACTION"; action: GameAction }
  | { kind: "FULL_STATE_SYNC"; session: GameSession; assets: AssetTemplate[]; deckTemplates: DeckTemplate[] }
  | { kind: "ASSET_SYNC"; assets: AssetTemplate[] }
  | { kind: "DECK_TEMPLATE_SYNC"; deckTemplates: DeckTemplate[] }
  | { kind: "LOBBY_SYNC"; lobby: LobbyState }
  | { kind: "START_GAME"; lobby: LobbyState; session: GameSession; assets: AssetTemplate[]; deckTemplates: DeckTemplate[] }
  | { kind: "ERROR"; message: string };

export interface PeerConnectionStatus {
  peerId: string;
  label: string;
  connected: boolean;
}
