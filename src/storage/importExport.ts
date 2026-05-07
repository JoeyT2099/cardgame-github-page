import type { AssetTemplate, DeckTemplate } from "../types/assets";
import type { GameSession, SessionBundle } from "../types/game";
import { getRequiredAssetIds } from "../store/selectors";

export interface DeckBundle {
  version: 1;
  kind: "deck";
  name: string;
  exportedAt: number;
  deck: DeckTemplate;
  assets: AssetTemplate[];
}

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
    throw new Error("Imported file is not a valid Card Game Sandbox session export.");
  }
  return value as SessionBundle;
};

export const createDeckBundle = (deck: DeckTemplate, assets: AssetTemplate[]): DeckBundle => {
  const requiredAssetIds = new Set(getDeckAssetIds(deck));
  return {
    version: 1,
    kind: "deck",
    name: deck.name,
    exportedAt: Date.now(),
    deck,
    assets: assets.filter((asset) => requiredAssetIds.has(asset.id))
  };
};

export const stringifyDeckBundle = (bundle: DeckBundle) => JSON.stringify(bundle, null, 2);

export const parseDeckBundle = (input: string): DeckBundle => {
  const value = JSON.parse(input) as Partial<DeckBundle>;
  if (value.version !== 1 || value.kind !== "deck" || !value.deck || !Array.isArray(value.assets)) {
    throw new Error("Imported file is not a valid Card Game Sandbox deck export.");
  }
  return value as DeckBundle;
};

export const mergeById = <T extends { id: string }>(current: T[], incoming: T[]) => {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    map.set(item.id, item);
  });
  return [...map.values()];
};
