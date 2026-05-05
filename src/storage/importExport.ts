import type { AssetTemplate, DeckTemplate } from "../types/assets";
import type { GameSession, SessionBundle } from "../types/game";
import { getRequiredAssetIds } from "../store/selectors";

const collectDeckTemplateIds = (session: GameSession) => new Set(session.deckInstances.map((deck) => deck.deckTemplateId));

const getDeckAssetIds = (deck: DeckTemplate) => [
  ...deck.cardAssetIds,
  ...(deck.defaultBackAssetId ? [deck.defaultBackAssetId] : []),
  ...Object.values(deck.cardBackAssetIds ?? {})
];

export const createSessionBundle = (
  session: GameSession,
  assets: AssetTemplate[],
  deckTemplates: DeckTemplate[],
  options?: { kind?: "session" | "game"; name?: string }
): SessionBundle => {
  const requiredAssetIds = new Set(getRequiredAssetIds(session));
  const deckTemplateIds = collectDeckTemplateIds(session);
  const requiredDecks = deckTemplates.filter((deck) => deckTemplateIds.has(deck.id));
  requiredDecks.forEach((deck) => {
    getDeckAssetIds(deck).forEach((assetId) => requiredAssetIds.add(assetId));
  });
  return {
    version: 1,
    kind: options?.kind ?? "session",
    name: options?.name ?? session.name,
    exportedAt: Date.now(),
    session,
    assets: assets.filter((asset) => requiredAssetIds.has(asset.id)),
    deckTemplates: requiredDecks
  };
};

export const stringifySessionBundle = (bundle: SessionBundle) => JSON.stringify(bundle, null, 2);

export const parseSessionBundle = (input: string): SessionBundle => {
  const value = JSON.parse(input) as Partial<SessionBundle>;
  if (value.version !== 1 || !value.session || !Array.isArray(value.assets) || !Array.isArray(value.deckTemplates)) {
    throw new Error("Imported file is not a valid Board Game Sandbox session export.");
  }
  return value as SessionBundle;
};

export const mergeById = <T extends { id: string }>(current: T[], incoming: T[]) => {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    map.set(item.id, item);
  });
  return [...map.values()];
};
