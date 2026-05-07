import type { AssetCategory, AssetTemplate } from "../types/assets";
import { deleteFromStore, getAllFromStore, putInStore, STORES } from "./indexedDb";

export const getAssets = () => getAllFromStore<AssetTemplate>(STORES.assets);
export const saveAsset = (asset: AssetTemplate) => putInStore(STORES.assets, asset);
export const deleteAsset = (id: string) => deleteFromStore(STORES.assets, id);

export const fileToAsset = (file: File, category: AssetCategory): Promise<AssetTemplate> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(`${file.name} is not an image file.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.onload = () => {
      const now = Date.now();
      const imageDataUrl = String(reader.result);
      const assetBase = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        imageDataUrl,
        category,
        tags: [],
        createdAt: now,
        updatedAt: now
      };
      const image = new Image();
      image.onload = () => resolve({ ...assetBase, originalWidth: image.naturalWidth, originalHeight: image.naturalHeight });
      image.onerror = () => resolve(assetBase);
      image.src = imageDataUrl;
    };
    reader.readAsDataURL(file);
  });
