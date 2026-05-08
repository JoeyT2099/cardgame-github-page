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
  | { kind: "ASSET_REQUEST"; assetIds: string[] }
  | { kind: "ASSET_DELETE"; assetId: string }
  | { kind: "DECK_TEMPLATE_SYNC"; deckTemplates: DeckTemplate[] }
  | { kind: "LOBBY_SYNC"; lobby: LobbyState }
  | { kind: "LOBBY_PLAYER_UPDATE"; playerId: string; updates: { name?: string; color?: string; ready?: boolean } }
  | { kind: "START_GAME"; lobby: LobbyState; session: GameSession; assets: AssetTemplate[]; deckTemplates: DeckTemplate[] }
  | { kind: "ERROR"; message: string }
  /** Sent by the host to a specific joining client to tell them which playerId they were assigned. */
  | { kind: "PLAYER_ASSIGN"; playerId: string };

export interface PeerConnectionStatus {
  peerId: string;
  label: string;
  connected: boolean;
}
