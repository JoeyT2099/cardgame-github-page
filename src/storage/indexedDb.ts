const DB_NAME = "cardgame-sandbox";
const DB_VERSION = 2;

export const STORES = {
  assets: "assets",
  deckTemplates: "deckTemplates",
  savedSessions: "savedSessions",
  savedGames: "savedGames",
  keyValue: "keyValue"
} as const;

let dbPromise: Promise<IDBDatabase> | undefined;

export const openDatabase = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      Object.values(STORES).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
        }
      });
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromise;
};

export const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T[]);
  });
};

export const putInStore = async <T extends { id: string }>(storeName: string, value: T): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).put(value);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const deleteFromStore = async (storeName: string, id: string): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getFromStore = async <T>(storeName: string, id: string): Promise<T | undefined> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T | undefined);
  });
};
