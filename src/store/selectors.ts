import type { AnyBoardObject, GameSession } from "../types/game";

export const getNextZIndex = (session: GameSession) => {
  const values = [
    ...session.deckInstances,
    ...session.cardInstances,
    ...session.discardPiles,
    ...session.tokenInstances,
    ...session.placedImageInstances
  ].map((item) => item.zIndex);
  return values.length ? Math.max(...values) + 1 : 1;
};

export const findBoardObject = (session: GameSession, objectId?: string): AnyBoardObject | undefined => {
  if (!objectId) return undefined;
  const deck = session.deckInstances.find((item) => item.id === objectId);
  if (deck) return { ...deck, type: "deck" };
  const card = session.cardInstances.find((item) => item.id === objectId);
  if (card) return { ...card, type: "card" };
  const discard = session.discardPiles.find((item) => item.id === objectId);
  if (discard) return { ...discard, type: "discard" };
  const token = session.tokenInstances.find((item) => item.id === objectId);
  if (token) return { ...token, type: "token" };
  const image = session.placedImageInstances.find((item) => item.id === objectId);
  if (image) return { ...image, type: "image" };
  return undefined;
};

export const getRequiredAssetIds = (session: GameSession): string[] => {
  const ids = new Set<string>();
  if (session.boardAssetId) ids.add(session.boardAssetId);
  session.cardInstances.forEach((card) => {
    ids.add(card.assetId);
    if (card.backAssetId) ids.add(card.backAssetId);
  });
  session.tokenInstances.forEach((token) => {
    if (token.assetId) ids.add(token.assetId);
  });
  session.placedImageInstances.forEach((image) => ids.add(image.assetId));
  return [...ids];
};
