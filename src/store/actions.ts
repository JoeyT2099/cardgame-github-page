import type { AssetTemplate, DeckTemplate } from "../types/assets";
import type { GameSession } from "../types/game";

export type GameActionType =
  | "SET_BOARD_IMAGE"
  | "CREATE_ASSET"
  | "SHARE_ASSET"
  | "CREATE_DECK_TEMPLATE"
  | "ADD_DECK_INSTANCE"
  | "MOVE_OBJECT"
  | "ROTATE_OBJECT"
  | "RESIZE_OBJECT"
  | "DRAW_CARD"
  | "FLIP_CARD"
  | "MOVE_CARD_TO_BOARD"
  | "MOVE_CARD_TO_HAND"
  | "MOVE_CARD_TO_DISCARD"
  | "CREATE_DISCARD_PILE"
  | "CREATE_TOKEN"
  | "UPDATE_TOKEN_COLOR"
  | "PLACE_IMAGE"
  | "DELETE_OBJECT"
  | "DUPLICATE_OBJECT"
  | "BRING_TO_FRONT"
  | "SEND_TO_BACK"
  | "SET_ACTIVE_PLAYER"
  | "UPDATE_PLAYER_NAME"
  | "UPDATE_LOBBY_PLAYER"
  | "SET_PLAYER_READY"
  | "START_GAME"
  | "NEW_SESSION"
  | "IMPORT_SESSION"
  | "LOAD_SESSION"
  | "FULL_STATE_SYNC"
  | "SELECT_OBJECT"
  | "CREATE_LAYER"
  | "DELETE_LAYER"
  | "RENAME_LAYER"
  | "TOGGLE_LAYER_VISIBILITY"
  | "TOGGLE_LAYER_LOCK"
  | "REORDER_LAYERS"
  | "ASSIGN_LAYER";

export interface GameAction<TPayload = unknown> {
  id: string;
  type: GameActionType;
  payload: TPayload;
  clientId: string;
  timestamp: number;
}

export interface MovePayload {
  objectId: string;
  objectType: "deck" | "card" | "discard" | "token" | "image";
  x: number;
  y: number;
  canvasId?: string;
}

export interface RotatePayload {
  objectId: string;
  objectType: MovePayload["objectType"];
  rotation: number;
}

export interface ResizePayload {
  objectId: string;
  objectType: MovePayload["objectType"];
  width: number;
  height: number;
}

export interface DrawCardPayload {
  deckInstanceId: string;
  playerId: string;
  chosenCardAssetId: string;
  cardInstanceId: string;
  backAssetId?: string;
}

export interface ImportSessionPayload {
  session: GameSession;
  assets: AssetTemplate[];
  deckTemplates: DeckTemplate[];
}

export const createAction = <TPayload>(
  type: GameActionType,
  payload: TPayload,
  clientId: string
): GameAction<TPayload> => ({
  id: crypto.randomUUID(),
  type,
  payload,
  clientId,
  timestamp: Date.now()
});
