import type { DeckTemplate } from "../types/assets";
import type { CardInstance, GameSession } from "../types/game";
import type { DrawCardPayload, GameAction, MovePayload, ResizePayload, RotatePayload } from "./actions";
import { createEmptySession } from "./initialState";
import { getNextZIndex } from "./selectors";

const touch = (session: GameSession): GameSession => ({ ...session, lastUpdatedAt: Date.now() });

const updateObject = (
  session: GameSession,
  objectType: MovePayload["objectType"],
  objectId: string,
  patch: Partial<{ x: number; y: number; rotation: number; width: number; height: number; zIndex: number }>
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
  action: GameAction<{ deckInstanceId: string; playerId: string; chosenCardAssetId?: string; cardInstanceId?: string }>
): GameAction<DrawCardPayload> | null => {
  const deck = session.deckInstances.find((item) => item.id === action.payload.deckInstanceId);
  if (!deck || deck.remainingCardAssetIds.length === 0) return null;
  const chosenCardAssetId =
    action.payload.chosenCardAssetId ?? deck.remainingCardAssetIds[Math.floor(Math.random() * deck.remainingCardAssetIds.length)];
  const template = deckTemplates.find((item) => item.id === deck.deckTemplateId);
  return {
    ...action,
    payload: {
      deckInstanceId: deck.id,
      playerId: action.payload.playerId,
      chosenCardAssetId,
      cardInstanceId: action.payload.cardInstanceId ?? crypto.randomUUID()
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
        backAssetId?: string;
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
            width: 96,
            height: 136
          }
        ],
        selectedObjectId: payload.id
      });
    }
    case "MOVE_OBJECT": {
      const payload = action.payload as MovePayload;
      return touch(updateObject(session, payload.objectType, payload.objectId, { x: payload.x, y: payload.y }));
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
      if (!deck || !player || !deck.remainingCardAssetIds.includes(payload.chosenCardAssetId)) return session;
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
        faceUp: true
      };
      return touch({
        ...session,
        deckInstances: session.deckInstances.map((item) =>
          item.id === deck.id
            ? {
                ...item,
                remainingCardAssetIds: item.remainingCardAssetIds.filter((id, index) => id !== payload.chosenCardAssetId || index !== item.remainingCardAssetIds.indexOf(payload.chosenCardAssetId)),
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
    case "FLIP_CARD": {
      const { cardId } = action.payload as { cardId: string };
      return touch({
        ...session,
        cardInstances: session.cardInstances.map((card) => (card.id === cardId ? { ...card, faceUp: !card.faceUp } : card))
      });
    }
    case "MOVE_CARD_TO_BOARD": {
      const payload = action.payload as { cardId: string; x: number; y: number };
      const withoutHands = removeFromHands(removeFromDiscards(session, payload.cardId), payload.cardId);
      return touch({
        ...withoutHands,
        cardInstances: withoutHands.cardInstances.map((card) =>
          card.id === payload.cardId
            ? { ...card, location: "board", ownerPlayerId: undefined, discardPileId: undefined, x: payload.x, y: payload.y, zIndex: getNextZIndex(withoutHands) }
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
      const withoutHands = removeFromHands(session, payload.cardId);
      return touch({
        ...withoutHands,
        cardInstances: withoutHands.cardInstances.map((card) =>
          card.id === payload.cardId ? { ...card, location: "discard", discardPileId: payload.discardPileId, ownerPlayerId: undefined } : card
        ),
        discardPiles: withoutHands.discardPiles.map((pile) =>
          pile.id === payload.discardPileId ? { ...pile, cardInstanceIds: [...new Set([...pile.cardInstanceIds, payload.cardId])] } : pile
        ),
        selectedObjectId: payload.discardPileId
      });
    }
    case "CREATE_DISCARD_PILE": {
      const payload = action.payload as { id: string; name: string; x: number; y: number };
      return touch({
        ...session,
        discardPiles: [
          ...session.discardPiles,
          { id: payload.id, name: payload.name, cardInstanceIds: [], x: payload.x, y: payload.y, rotation: 0, zIndex: getNextZIndex(session), width: 112, height: 144 }
        ],
        selectedObjectId: payload.id
      });
    }
    case "CREATE_TOKEN": {
      const payload = action.payload as { id: string; assetId?: string; label?: string; color?: string; x: number; y: number };
      return touch({
        ...session,
        tokenInstances: [
          ...session.tokenInstances,
          { id: payload.id, assetId: payload.assetId, label: payload.label, color: payload.color, x: payload.x, y: payload.y, rotation: 0, zIndex: getNextZIndex(session), width: 64, height: 64 }
        ],
        selectedObjectId: payload.id
      });
    }
    case "PLACE_IMAGE": {
      const payload = action.payload as { id: string; assetId: string; x: number; y: number };
      return touch({
        ...session,
        placedImageInstances: [
          ...session.placedImageInstances,
          { id: payload.id, assetId: payload.assetId, x: payload.x, y: payload.y, rotation: 0, zIndex: getNextZIndex(session), width: 180, height: 140 }
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
      return action.payload as GameSession;
    default:
      return session;
  }
};
