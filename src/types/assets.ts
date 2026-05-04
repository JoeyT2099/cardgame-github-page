export type AssetCategory = "card" | "board" | "token" | "deck" | "misc";

export interface AssetTemplate {
  id: string;
  name: string;
  imageDataUrl: string;
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
  createdAt: number;
  updatedAt: number;
}

export type AssetFilter = "all" | "card" | "board" | "token" | "deck" | "misc";
