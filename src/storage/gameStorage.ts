import type { SavedGameRecord, SessionBundle } from "../types/game";
import { deleteFromStore, getAllFromStore, putInStore, STORES } from "./indexedDb";

export const getSavedGames = () => getAllFromStore<SavedGameRecord>(STORES.savedGames);

export const saveGameBundle = (name: string, bundle: SessionBundle) => {
  const now = Date.now();
  const record: SavedGameRecord = {
    id: crypto.randomUUID(),
    name,
    updatedAt: now,
    bundle: {
      ...bundle,
      kind: "game",
      name,
      exportedAt: now
    }
  };
  return putInStore<SavedGameRecord>(STORES.savedGames, record);
};

export const deleteSavedGame = (id: string) => deleteFromStore(STORES.savedGames, id);
