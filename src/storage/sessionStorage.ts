import type { GameSession } from "../types/game";
import { deleteFromStore, getAllFromStore, getFromStore, putInStore, STORES } from "./indexedDb";

interface CurrentSessionRecord {
  id: "currentSession";
  session: GameSession;
}

export interface SavedSessionRecord {
  id: string;
  name: string;
  updatedAt: number;
  session: GameSession;
}

export const saveCurrentSession = (session: GameSession) =>
  putInStore<CurrentSessionRecord>(STORES.keyValue, { id: "currentSession", session });

export const loadCurrentSession = async () => {
  const record = await getFromStore<CurrentSessionRecord>(STORES.keyValue, "currentSession");
  return record?.session;
};

export const getSavedSessions = () => getAllFromStore<SavedSessionRecord>(STORES.savedSessions);

export const saveNamedSession = (session: GameSession) =>
  putInStore<SavedSessionRecord>(STORES.savedSessions, {
    id: session.id,
    name: session.name,
    updatedAt: Date.now(),
    session
  });

export const deleteSavedSession = (id: string) => deleteFromStore(STORES.savedSessions, id);
