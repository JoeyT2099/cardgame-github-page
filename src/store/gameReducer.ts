import type { DeckTemplate } from "../types/assets";
import type { CardInstance, GameSession, Layer, TokenShape } from "../types/game";
import type { DrawCardPayload, GameAction, MovePayload, ResizePayload, RotatePayload } from "./actions";
import { createCanvasTabs, createEmptySession, DEFAULT_LAYERS, LAYER_IDS, MAIN_CANVAS_ID } from "./initialState";
import { getNextZIndex } from "./selectors";

const touch = (session: GameSession): GameSession => ({ ...session, lastUpdatedAt: Date.now() });

const ensureDefaultLayer = (layers: Layer[]): Layer[] => {
  const normalized = layers.length > 0 ? layers.map((layer) => ({ ...layer })) : DEFAULT_LAYERS.map((layer) => ({ ...layer }));
  if (normalized.some((layer) => layer.id === LAYER_IDS.default)) {
    return normalized.map((layer) => (layer.id === LAYER_IDS.default ? { ...layer, visible: true, locked: false } : layer));
  }
  const maxOrder = normalized.reduce((max, layer) => Math.max(max, layer.order), -1);
  return [...normalized, { id: LAYER_IDS.default, name: "Default", visible: true, locked: false, order: maxOrder + 1 }];
};

/** Ensure every loaded session has required layers/canvases and every object has a valid layerId. */
const migrateSession = (session: GameSession): GameSession => {
  const layers = ensureDefaultLayer(session.layers ?? []);
  const validLayerIds = new Set(layers.map((layer) => layer.id));
  const defaultLayerId = LAYER_IDS.default;
  const tokenLayerId = (layers.find((l) => l.id === LAYER_IDS.tokens) ?? layers[0]).id;
  const boardLayerId = (layers.find((l) => l.id === LAYER_IDS.board) ?? layers[0]).id;
  const cardLayerId = (layers.find((l) => l.id === LAYER_IDS.cards) ?? layers[0]).id;
  const canvasTabs = session.canvasTabs && session.canvasTabs.length > 0 ? session.canvasTabs : createCanvasTabs();
  const defaultCanvasId = canvasTabs[0]?.id ?? MAIN_CANVAS_ID;
  const validLayerOr = (layerId: string | undefined, fallbackLayerId: string) => {
    if (!layerId) return fallbackLayerId;
    return validLayerIds.has(layerId) ? layerId : LAYER_IDS.default;
  };
  return {
    ...session,
    layers,
    canvasTabs,
    deckInstances: session.deckInstances.map((item) => ({ ...item, layerId: validLayerOr(item.layerId, cardLayerId), canvasId: item.canvasId ?? defaultCanvasId })),
    cardInstances: session.cardInstances.map((item) => ({ ...item, layerId: validLayerOr(item.layerId, cardLayerId), canvasId: item.canvasId ?? defaultCanvasId })),
    discardPiles: session.discardPiles.map((item) => ({ ...item, layerId: validLayerOr(item.layerId, cardLayerId), canvasId: item.canvasId ?? defaultCanvasId })),
    tokenInstances: session.tokenInstances.map((item) => ({ ...item, layerId: validLayerOr(item.layerId, tokenLayerId), canvasId: item.canvasId ?? defaultCanvasId, shape: item.shape ?? "square" })),
    placedImageInstances: session.placedImageInstances.map((item) => ({ ...item, layerId: validLayerOr(item.layerId, boardLayerId || defaultLayerId), canvasId: item.canvasId ?? defaultCanvasId }))
  };
};

const updateObject = (
  session: GameSession,
  objectType: MovePayload["objectType"],
  objectId: string,
  patch: Partial<{ x: number; y: number; rotation: number; width: number; height: number; zIndex: number; layerId: string; canvasId: string }>
): GameSession => {
  const update = <T extends { id: string }>(items: T[]) => items.map((item) => (item.id === objectId ? { ...item, ...patch } : item));
  if (objectType === "deck") return { ...session, deckInstances: update(session.deckInstances) };
  if (objectType === "card") return { ...session, cardInstances: update(session.cardInstances) };
  if (objectType === "discard") return { ...session, discardPiles: update(session.discardPiles) };
  if (objectType === "token") return { ...session, tokenInstances: update(session.tokenInstances) };
  return { ...session, placedImageInstances: update(session.placedImageInstances) };
};

const removeFromHands = (session: GameSession, cardId: string): GameSession => ({
  ...session,
  players: session.players.map((player) => ({
    ...player,
    handCardInstanceIds: player.handCardInstanceIds.filter((id) => id !== cardId)
  }))
});

const removeFromDiscards = (session: GameSession, cardId: string): GameSession => ({
  ...session,
  discardPiles: session.discardPiles.map((pile) => ({
    ...pile,
    cardInstanceIds: pile.cardInstanceIds.filter((id) => id !== cardId)
  }))
});

export const resolveDrawAction = (
  session: GameSession,
  deckTemplates: DeckTemplate[],
  action: GameAction<{ deckInstanceId: string; playerId: string; chosenCardAssetId?: string; chosenCardIndex?: number; cardInstanceId?: string; drawMode?: "top" | "random" }>
): GameAction<DrawCardPayload> | null => {
  const deck = session.deckInstances.find((item) => item.id === action.payload.deckInstanceId);
  if (!deck || deck.remainingCardAssetIds.length === 0) return null;
  const requestedIndex = action.payload.chosenCardIndex;
  const chosenCardIndex =
    typeof requestedIndex === "number" && requestedIndex >= 0 && requestedIndex < deck.remainingCardAssetIds.length
      ? requestedIndex
      : action.payload.drawMode === "top"
        ? 0
        : Math.floor(Math.random() * deck.remainingCardAssetIds.length);
  const chosenCardAssetId = action.payload.chosenCardAssetId ?? deck.remainingCardAssetIds[chosenCardIndex];
  const template = deckTemplates.find((item) => item.id === deck.deckTemplateId);
  return {
    ...action,
    payload: {
      deckInstanceId: deck.id,
      playerId: action.payload.playerId,
      chosenCardAssetId,
      chosenCardIndex,
      cardInstanceId: action.payload.cardInstanceId ?? crypto.randomUUID(),
      backAssetId: template?.cardBackAssetIds?.[chosenCardAssetId] || template?.defaultBackAssetId
    }
  };
};

export const gameReducer = (session: GameSession, action: GameAction): GameSession => {
  switch (action.type) {
    case "SET_BOARD_IMAGE":
      return touch({ ...session, boardAssetId: (action.payload as { assetId?: string }).assetId, selectedObjectId: undefined });
    case "SELECT_OBJECT":
      return { ...session, selectedObjectId: (action.payload as { objectId?: string }).objectId };
    case "ADD_DECK_INSTANCE": {
      const payload = action.payload as {
        id: string;
        deckTemplateId: string;
        name: string;
        cardAssetIds: string[];
        x: number;
        y: number;
        width?: number;
        height?: number;
        backAssetId?: string;
        layerId?: string;
        canvasId?: string;
      };
      return touch({
        ...session,
        deckInstances: [
          ...session.deckInstances,
          {
            id: payload.id,
            deckTemplateId: payload.deckTemplateId,
            name: payload.name,
            remainingCardAssetIds: [...payload.cardAssetIds],
            drawnCardAssetIds: [],
            x: payload.x,
            y: payload.y,
            rotation: 0,
            zIndex: getNextZIndex(session),
            width: payload.width ?? 96,
            height: payload.height ?? 136,
            layerId: payload.layerId ?? LAYER_IDS.cards,
            canvasId: payload.canvasId ?? MAIN_CANVAS_ID
          }
        ],
        selectedObjectId: payload.id
      });
    }
    case "MOVE_OBJECT": {
      const payload = action.payload as MovePayload;
      return touch(updateObject(session, payload.objectType, payload.objectId, { x: payload.x, y: payload.y, ...(payload.canvasId ? { canvasId: payload.canvasId } : {}) }));
    }
    case "ROTATE_OBJECT": {
      const payload = action.payload as RotatePayload;
      return touch(updateObject(session, payload.objectType, payload.objectId, { rotation: payload.rotation }));
    }
    case "RESIZE_OBJECT": {
      const payload = action.payload as ResizePayload;
      return touch(updateObject(session, payload.objectType, payload.objectId, { width: payload.width, height: payload.height }));
    }
    case "DRAW_CARD": {
      const payload = action.payload as DrawCardPayload;
      const deck = session.deckInstances.find((item) => item.id === payload.deckInstanceId);
      const player = session.players.find((item) => item.id === payload.playerId);
      if (!deck || !player || deck.remainingCardAssetIds[payload.chosenCardIndex] !== payload.chosenCardAssetId) return session;
      const card: CardInstance = {
        id: payload.cardInstanceId,
        assetId: payload.chosenCardAssetId,
        sourceDeckInstanceId: deck.id,
        ownerPlayerId: player.id,
        location: "hand",
        x: 40,
        y: 40,
        rotation: 0,
        zIndex: getNextZIndex(session),
        width: 96,
        height: 136,
        faceUp: false,
        backAssetId: payload.backAssetId,
        layerId: deck.layerId ?? LAYER_IDS.cards,
        canvasId: deck.canvasId ?? MAIN_CANVAS_ID
      };
      return touch({
        ...session,
        deckInstances: session.deckInstances.map((item) =>
          item.id === deck.id
            ? {
                ...item,
                remainingCardAssetIds: item.remainingCardAssetIds.filter((_, index) => index !== payload.chosenCardIndex),
                drawnCardAssetIds: [...item.drawnCardAssetIds, payload.chosenCardAssetId]
              }
            : item
        ),
        cardInstances: [...session.cardInstances, card],
        players: session.players.map((item) =>
          item.id === player.id ? { ...item, handCardInstanceIds: [...item.handCardInstanceIds, card.id] } : item
        )
      });
    }
    case "REORDER_DECK_CARD": {
      const payload = action.payload as { deckInstanceId: string; fromIndex: number; toIndex: number };
      const deck = session.deckInstances.find((item) => item.id === payload.deckInstanceId);
      if (!deck || deck.remainingCardAssetIds.length === 0) return session;
      const fromIndex = Math.max(0, Math.min(deck.remainingCardAssetIds.length - 1, payload.fromIndex));
      const toIndex = Math.max(0, Math.min(deck.remainingCardAssetIds.length - 1, payload.toIndex));
      if (fromIndex === toIndex) return session;
      const nextCards = [...deck.remainingCardAssetIds];
      const [cardAssetId] = nextCards.splice(fromIndex, 1);
      nextCards.splice(toIndex, 0, cardAssetId);
      return touch({
        ...session,
        deckInstances: session.deckInstances.map((item) =>
          item.id === deck.id ? { ...item, remainingCardAssetIds: nextCards } : item
        )
      });
    }
    case "FLIP_CARD": {
      const { cardId } = action.payload as { cardId: string };
      return touch({
        ...session,
        cardInstances: session.cardInstances.map((card) => (card.id === cardId ? { ...card, faceUp: !card.faceUp } : card))
      });
    }
    case "MOVE_CARD_TO_BOARD": {
      const payload = action.payload as { cardId: string; x: number; y: number; canvasId?: string };
      const sourcePile = session.discardPiles.find((pile) => pile.cardInstanceIds.includes(payload.cardId));
      const withoutHands = removeFromHands(removeFromDiscards(session, payload.cardId), payload.cardId);
      return touch({
        ...withoutHands,
        cardInstances: withoutHands.cardInstances.map((card) =>
          card.id === payload.cardId
            ? { ...card, location: "board", ownerPlayerId: undefined, discardPileId: undefined, x: payload.x, y: payload.y, zIndex: getNextZIndex(withoutHands), layerId: sourcePile?.layerId ?? card.layerId, canvasId: sourcePile?.canvasId ?? payload.canvasId ?? card.canvasId ?? MAIN_CANVAS_ID }
            : card
        ),
        selectedObjectId: payload.cardId
      });
    }
    case "MOVE_CARD_TO_HAND": {
      const payload = action.payload as { cardId: string; playerId: string };
      const withoutDiscards = removeFromDiscards(session, payload.cardId);
      return touch({
        ...withoutDiscards,
        cardInstances: withoutDiscards.cardInstances.map((card) =>
          card.id === payload.cardId ? { ...card, location: "hand", ownerPlayerId: payload.playerId, discardPileId: undefined } : card
        ),
        players: withoutDiscards.players.map((player) => ({
          ...player,
          handCardInstanceIds:
            player.id === payload.playerId
              ? [...new Set([...player.handCardInstanceIds, payload.cardId])]
              : player.handCardInstanceIds.filter((id) => id !== payload.cardId)
        })),
        selectedObjectId: undefined
      });
    }
    case "MOVE_CARD_TO_DISCARD": {
      const payload = action.payload as { cardId: string; discardPileId: string };
      const targetPile = session.discardPiles.find((pile) => pile.id === payload.discardPileId);
      const withoutHands = removeFromHands(removeFromDiscards(session, payload.cardId), payload.cardId);
      return touch({
        ...withoutHands,
        cardInstances: withoutHands.cardInstances.map((card) =>
          card.id === payload.cardId ? { ...card, location: "discard", discardPileId: payload.discardPileId, ownerPlayerId: undefined, layerId: targetPile?.layerId ?? card.layerId, canvasId: targetPile?.canvasId ?? card.canvasId } : card
        ),
        discardPiles: withoutHands.discardPiles.map((pile) =>
          pile.id === payload.discardPileId ? { ...pile, cardInstanceIds: [...new Set([...pile.cardInstanceIds, payload.cardId])] } : pile
        ),
        selectedObjectId: payload.discardPileId
      });
    }
    case "RENAME_DISCARD_PILE": {
      const payload = action.payload as { discardPileId: string; name: string };
      return touch({
        ...session,
        discardPiles: session.discardPiles.map((pile) => (pile.id === payload.discardPileId ? { ...pile, name: payload.name } : pile))
      });
    }
    case "CREATE_DISCARD_PILE": {
      const payload = action.payload as { id: string; name: string; x: number; y: number; layerId?: string; canvasId?: string };
      return touch({
        ...session,
        discardPiles: [
          ...session.discardPiles,
          { id: payload.id, name: payload.name, cardInstanceIds: [], x: payload.x, y: payload.y, rotation: 0, zIndex: getNextZIndex(session), width: 112, height: 144, layerId: payload.layerId ?? LAYER_IDS.cards, canvasId: payload.canvasId ?? MAIN_CANVAS_ID }
        ],
        selectedObjectId: payload.id
      });
    }
    case "CREATE_TOKEN": {
      const payload = action.payload as { id: string; assetId?: string; label?: string; color?: string; shape?: TokenShape; x: number; y: number; width?: number; height?: number; layerId?: string; canvasId?: string };
      return touch({
        ...session,
        tokenInstances: [
          ...session.tokenInstances,
          { id: payload.id, assetId: payload.assetId, label: payload.label, color: payload.color, shape: payload.shape ?? "square", x: payload.x, y: payload.y, rotation: 0, zIndex: getNextZIndex(session), width: payload.width ?? 64, height: payload.height ?? 64, layerId: payload.layerId ?? LAYER_IDS.tokens, canvasId: payload.canvasId ?? MAIN_CANVAS_ID }
        ],
        selectedObjectId: payload.id
      });
    }
    case "UPDATE_TOKEN_COLOR": {
      const payload = action.payload as { tokenId: string; color: string };
      return touch({
        ...session,
        tokenInstances: session.tokenInstances.map((token) =>
          token.id === payload.tokenId ? { ...token, color: payload.color } : token
        )
      });
    }
    case "UPDATE_TOKEN_SHAPE": {
      const payload = action.payload as { tokenId: string; shape: TokenShape };
      return touch({
        ...session,
        tokenInstances: session.tokenInstances.map((token) =>
          token.id === payload.tokenId ? { ...token, shape: payload.shape } : token
        )
      });
    }
    case "PLACE_IMAGE": {
      const payload = action.payload as { id: string; assetId: string; x: number; y: number; width?: number; height?: number; layerId?: string; canvasId?: string };
      return touch({
        ...session,
        placedImageInstances: [
          ...session.placedImageInstances,
          { id: payload.id, assetId: payload.assetId, x: payload.x, y: payload.y, rotation: 0, zIndex: getNextZIndex(session), width: payload.width ?? 180, height: payload.height ?? 140, layerId: payload.layerId ?? LAYER_IDS.board, canvasId: payload.canvasId ?? MAIN_CANVAS_ID }
        ],
        selectedObjectId: payload.id
      });
    }
    case "DELETE_OBJECT": {
      const payload = action.payload as { objectId: string; objectType: MovePayload["objectType"] };
      const cardIdsToRemove = payload.objectType === "discard" ? session.discardPiles.find((pile) => pile.id === payload.objectId)?.cardInstanceIds ?? [] : [];
      return touch({
        ...session,
        deckInstances: payload.objectType === "deck" ? session.deckInstances.filter((item) => item.id !== payload.objectId) : session.deckInstances,
        cardInstances:
          payload.objectType === "card"
            ? session.cardInstances.filter((item) => item.id !== payload.objectId)
            : session.cardInstances.filter((item) => !cardIdsToRemove.includes(item.id)),
        discardPiles: payload.objectType === "discard" ? session.discardPiles.filter((item) => item.id !== payload.objectId) : session.discardPiles,
        tokenInstances: payload.objectType === "token" ? session.tokenInstances.filter((item) => item.id !== payload.objectId) : session.tokenInstances,
        placedImageInstances: payload.objectType === "image" ? session.placedImageInstances.filter((item) => item.id !== payload.objectId) : session.placedImageInstances,
        players: session.players.map((player) => ({
          ...player,
          handCardInstanceIds: player.handCardInstanceIds.filter((id) => id !== payload.objectId && !cardIdsToRemove.includes(id))
        })),
        selectedObjectId: undefined
      });
    }
    case "DUPLICATE_OBJECT": {
      const payload = action.payload as { objectId: string; objectType: MovePayload["objectType"]; newId: string };
      const offset = { x: 24, y: 24, zIndex: getNextZIndex(session) };
      if (payload.objectType === "card") {
        const card = session.cardInstances.find((item) => item.id === payload.objectId);
        if (!card) return session;
        return touch({ ...session, cardInstances: [...session.cardInstances, { ...card, ...offset, id: payload.newId, location: "board", ownerPlayerId: undefined }], selectedObjectId: payload.newId });
      }
      if (payload.objectType === "token") {
        const token = session.tokenInstances.find((item) => item.id === payload.objectId);
        if (!token) return session;
        return touch({ ...session, tokenInstances: [...session.tokenInstances, { ...token, ...offset, id: payload.newId }], selectedObjectId: payload.newId });
      }
      if (payload.objectType === "image") {
        const image = session.placedImageInstances.find((item) => item.id === payload.objectId);
        if (!image) return session;
        return touch({ ...session, placedImageInstances: [...session.placedImageInstances, { ...image, ...offset, id: payload.newId }], selectedObjectId: payload.newId });
      }
      return session;
    }
    case "BRING_TO_FRONT": {
      const payload = action.payload as { objectId: string; objectType: MovePayload["objectType"] };
      return touch(updateObject(session, payload.objectType, payload.objectId, { zIndex: getNextZIndex(session) }));
    }
    case "SEND_TO_BACK": {
      const payload = action.payload as { objectId: string; objectType: MovePayload["objectType"] };
      return touch(updateObject(session, payload.objectType, payload.objectId, { zIndex: 0 }));
    }
    case "SET_ACTIVE_PLAYER":
      return touch({ ...session, activePlayerId: (action.payload as { playerId: string }).playerId });
    case "UPDATE_PLAYER_NAME": {
      const payload = action.payload as { playerId: string; name: string };
      return touch({ ...session, players: session.players.map((player) => (player.id === payload.playerId ? { ...player, name: payload.name } : player)) });
    }
    case "NEW_SESSION":
      return createEmptySession((action.payload as { playerCount: 2 | 3 | 4 }).playerCount, "New Session");
    case "LOAD_SESSION":
    case "FULL_STATE_SYNC":
    case "START_GAME":
      return migrateSession(action.payload as GameSession);
    case "CREATE_LAYER": {
      const payload = action.payload as { id: string; name: string };
      const maxOrder = session.layers.reduce((max, l) => Math.max(max, l.order), -1);
      const newLayer: Layer = { id: payload.id, name: payload.name, visible: true, locked: false, order: maxOrder + 1 };
      return touch({ ...session, layers: [...session.layers, newLayer] });
    }
    case "DELETE_LAYER": {
      const payload = action.payload as { layerId: string; fallbackLayerId: string };
      if (payload.layerId === LAYER_IDS.default || session.layers.length <= 1) return session;
      const reassign = <T extends { layerId?: string }>(items: T[]): T[] =>
        items.map((item) => (item.layerId === payload.layerId ? { ...item, layerId: LAYER_IDS.default } : item));
      return touch({
        ...session,
        layers: session.layers.filter((l) => l.id !== payload.layerId),
        deckInstances: reassign(session.deckInstances),
        cardInstances: reassign(session.cardInstances),
        discardPiles: reassign(session.discardPiles),
        tokenInstances: reassign(session.tokenInstances),
        placedImageInstances: reassign(session.placedImageInstances)
      });
    }
    case "RENAME_LAYER": {
      const payload = action.payload as { layerId: string; name: string };
      return touch({ ...session, layers: session.layers.map((l) => (l.id === payload.layerId ? { ...l, name: payload.name } : l)) });
    }
    case "TOGGLE_LAYER_VISIBILITY": {
      const payload = action.payload as { layerId: string };
      if (payload.layerId === LAYER_IDS.default) return session;
      return touch({ ...session, layers: session.layers.map((l) => (l.id === payload.layerId ? { ...l, visible: !l.visible } : l)) });
    }
    case "TOGGLE_LAYER_LOCK": {
      const payload = action.payload as { layerId: string };
      if (payload.layerId === LAYER_IDS.default) return session;
      return touch({ ...session, layers: session.layers.map((l) => (l.id === payload.layerId ? { ...l, locked: !l.locked } : l)) });
    }
    case "REORDER_LAYERS": {
      const payload = action.payload as { layerIds: string[] };
      const reordered = payload.layerIds
        .map((id, index) => {
          const layer = session.layers.find((l) => l.id === id);
          return layer ? { ...layer, order: index } : null;
        })
        .filter((l): l is Layer => l !== null);
      const existing = session.layers.filter((l) => !payload.layerIds.includes(l.id));
      return touch({ ...session, layers: [...reordered, ...existing] });
    }
    case "ASSIGN_LAYER": {
      const payload = action.payload as { objectId: string; objectType: MovePayload["objectType"]; layerId: string };
      return touch(updateObject(session, payload.objectType, payload.objectId, { layerId: payload.layerId }));
    }
    case "CREATE_CANVAS": {
      const payload = action.payload as { id: string; name: string };
      return touch({ ...session, canvasTabs: [...session.canvasTabs, { id: payload.id, name: payload.name }] });
    }
    case "DELETE_CANVAS": {
      const payload = action.payload as { canvasId: string; fallbackCanvasId: string };
      if (session.canvasTabs.length <= 1) return session;
      const reassignCanvas = <T extends { canvasId?: string }>(items: T[]): T[] =>
        items.map((item) => (item.canvasId === payload.canvasId ? { ...item, canvasId: payload.fallbackCanvasId } : item));
      return touch({
        ...session,
        canvasTabs: session.canvasTabs.filter((canvas) => canvas.id !== payload.canvasId),
        deckInstances: reassignCanvas(session.deckInstances),
        cardInstances: reassignCanvas(session.cardInstances),
        discardPiles: reassignCanvas(session.discardPiles),
        tokenInstances: reassignCanvas(session.tokenInstances),
        placedImageInstances: reassignCanvas(session.placedImageInstances),
        selectedObjectId: undefined
      });
    }
    case "RENAME_CANVAS": {
      const payload = action.payload as { canvasId: string; name: string };
      return touch({ ...session, canvasTabs: session.canvasTabs.map((canvas) => (canvas.id === payload.canvasId ? { ...canvas, name: payload.name } : canvas)) });
    }
    default:
      return session;
  }
};
