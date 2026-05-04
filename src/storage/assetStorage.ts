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
      resolve({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        imageDataUrl: String(reader.result),
        category,
        tags: [],
        createdAt: now,
        updatedAt: now
      });
    };
    reader.readAsDataURL(file);
  });
