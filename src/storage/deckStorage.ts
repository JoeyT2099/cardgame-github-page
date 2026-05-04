import type { DeckTemplate } from "../types/assets";
import { deleteFromStore, getAllFromStore, putInStore, STORES } from "./indexedDb";

export const getDeckTemplates = () => getAllFromStore<DeckTemplate>(STORES.deckTemplates);
export const saveDeckTemplate = (deck: DeckTemplate) => putInStore(STORES.deckTemplates, deck);
export const deleteDeckTemplate = (id: string) => deleteFromStore(STORES.deckTemplates, id);
