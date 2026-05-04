import type { AssetTemplate, DeckTemplate } from "../types/assets";
import type { GameSession } from "../types/game";
import { getRequiredAssetIds } from "../store/selectors";

export const getAssetsForSession = (session: GameSession, assets: AssetTemplate[], deckTemplates: DeckTemplate[]) => {
  const required = new Set(getRequiredAssetIds(session));
  session.deckInstances.forEach((instance) => {
    const template = deckTemplates.find((item) => item.id === instance.deckTemplateId);
    template?.cardAssetIds.forEach((assetId) => required.add(assetId));
    if (template?.defaultBackAssetId) required.add(template.defaultBackAssetId);
  });
  return assets.filter((asset) => required.has(asset.id));
};

export const markSharedAssets = (assets: AssetTemplate[], sharedIds: string[]) =>
  assets.map((asset) => (sharedIds.includes(asset.id) ? { ...asset, sharedInSession: true } : asset));
