import type { AssetTemplate, DeckTemplate } from "../types/assets";
import type { GameSession, SessionBundle } from "../types/game";
import { getRequiredAssetIds } from "../store/selectors";

const collectDeckTemplateIds = (session: GameSession) => new Set(session.deckInstances.map((deck) => deck.deckTemplateId));

export const createSessionBundle = (
  session: GameSession,
  assets: AssetTemplate[],
  deckTemplates: DeckTemplate[]
): SessionBundle => {
  const requiredAssetIds = new Set(getRequiredAssetIds(session));
  const deckTemplateIds = collectDeckTemplateIds(session);
  const requiredDecks = deckTemplates.filter((deck) => deckTemplateIds.has(deck.id));
  requiredDecks.forEach((deck) => {
    deck.cardAssetIds.forEach((assetId) => requiredAssetIds.add(assetId));
    if (deck.defaultBackAssetId) requiredAssetIds.add(deck.defaultBackAssetId);
  });
  return {
    version: 1,
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
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return [...map.values()];
};
