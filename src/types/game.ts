import type { DeckTemplate } from "./assets";

export type BoardObjectType = "deck" | "card" | "discard" | "token" | "image";
export type CardLocation = "hand" | "board" | "discard";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface CanvasTab {
  id: string;
  name: string;
}

export interface BoardObjectBase {
  id: string;
  type: BoardObjectType;
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
  width: number;
  height: number;
  layerId?: string;
  canvasId?: string;
}

export interface DeckInstance extends Omit<BoardObjectBase, "type"> {
  deckTemplateId: string;
  name: string;
  remainingCardAssetIds: string[];
  drawnCardAssetIds: string[];
  locked?: boolean;
}

export interface CardInstance extends Omit<BoardObjectBase, "type"> {
  assetId: string;
  sourceDeckInstanceId?: string;
  ownerPlayerId?: string;
  location: CardLocation;
  discardPileId?: string;
  faceUp: boolean;
  backAssetId?: string;
}

export interface DiscardPile extends Omit<BoardObjectBase, "type"> {
  name: string;
  cardInstanceIds: string[];
}

export interface TokenInstance extends Omit<BoardObjectBase, "type"> {
  assetId?: string;
  label?: string;
  color?: string;
}

export interface PlacedImageInstance extends Omit<BoardObjectBase, "type"> {
  assetId: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  handCardInstanceIds: string[];
}

export interface GameSession {
  id: string;
  name: string;
  boardAssetId?: string;
  players: Player[];
  activePlayerId: string;
  deckInstances: DeckInstance[];
  cardInstances: CardInstance[];
  discardPiles: DiscardPile[];
  tokenInstances: TokenInstance[];
  placedImageInstances: PlacedImageInstance[];
  layers: Layer[];
  canvasTabs: CanvasTab[];
  selectedObjectId?: string;
  lastUpdatedAt: number;
}

export interface SessionBundle {
  version: 1;
  kind?: "session" | "game";
  name?: string;
  exportedAt: number;
  session: GameSession;
  assets: import("./assets").AssetTemplate[];
  deckTemplates: DeckTemplate[];
}

export interface SavedGameRecord {
  id: string;
  name: string;
  updatedAt: number;
  bundle: SessionBundle;
}

export type AnyBoardObject =
  | (DeckInstance & { type: "deck" })
  | (CardInstance & { type: "card" })
  | (DiscardPile & { type: "discard" })
  | (TokenInstance & { type: "token" })
  | (PlacedImageInstance & { type: "image" });
