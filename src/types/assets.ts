export type AssetCategory = "card" | "board" | "token" | "deck" | "misc";

export interface AssetTemplate {
  id: string;
  name: string;
  imageDataUrl: string;
  originalWidth?: number;
  originalHeight?: number;
  category: AssetCategory;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  sharedInSession?: boolean;
}

export interface DeckTemplate {
  id: string;
  name: string;
  cardAssetIds: string[];
  defaultBackAssetId?: string;
  cardBackAssetIds?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export type AssetFilter = "all" | "card" | "board" | "token" | "deck" | "misc";
