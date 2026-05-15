import React from "react";
import { AddDeckModal } from "./components/AddDeckModal";
import { AssetLibraryModal } from "./components/AssetLibraryModal";
import { BoardCanvas } from "./components/BoardCanvas";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DeckCreatorModal } from "./components/DeckCreatorModal";
import { LayersPanel } from "./components/LayersPanel";
import { LobbyPanel } from "./components/LobbyPanel";
import { MultiplayerPanel } from "./components/MultiplayerPanel";
import { ObjectInspector } from "./components/ObjectInspector";
import { PlayerHands } from "./components/PlayerHands";
import { SessionManagerModal } from "./components/SessionManagerModal";
import { Toolbar } from "./components/Toolbar";
import { createAction, type GameAction } from "./store/actions";
import { gameReducer, resolveDrawAction } from "./store/gameReducer";
import { createEmptySession, createLobby, createLobbyPlayer, createPlayers, LAYER_IDS, MAIN_CANVAS_ID } from "./store/initialState";
import { findBoardObject } from "./store/selectors";
import type { AssetCategory, AssetTemplate, DeckTemplate } from "./types/assets";
import type { AnyBoardObject, GameSession, SavedGameRecord, SessionBundle, TokenShape } from "./types/game";
import type { AppMode, LobbyState } from "./types/lobby";
import type { MultiplayerMessage, NetworkStatus, PeerConnectionStatus } from "./types/multiplayer";
import { getAssetsForSession, getRequiredAssetIdsForSession } from "./multiplayer/assetSync";
import { ClientSync } from "./multiplayer/clientSync";
import { HostSync } from "./multiplayer/hostSync";
import { getAssets, saveAsset, deleteAsset } from "./storage/assetStorage";
import { deleteDeckTemplate, getDeckTemplates, saveDeckTemplate } from "./storage/deckStorage";
import { deleteSavedGame, getSavedGames, saveGameBundle } from "./storage/gameStorage";
import { createDeckBundle, createSessionBundle, mergeById, parseDeckBundle, parseSessionBundle, stringifyDeckBundle, stringifySessionBundle } from "./storage/importExport";
import { loadCurrentSession, saveCurrentSession } from "./storage/sessionStorage";

type ModalName = "assets" | "setBoard" | "createDeck" | "addDeck" | "placeImage" | "token" | "games" | "multiplayer" | undefined;
type PendingInvite = { peerId: string; offerCode: string; createdAt: number };
type UndoEntry = { actorId: string; before: GameSession; action: GameAction };

const CLIENT_ID_KEY = "cardgame-sandbox.clientId";
const ASSIGNED_PLAYER_KEY = "cardgame-sandbox.assignedPlayerId";
const MISSING_ASSET_RETRY_MS = 5_000;

const getStoredValue = (key: string) => {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const setStoredValue = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing; the session still works in memory.
  }
};

const getClientId = () => {
  const existing = getStoredValue(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  setStoredValue(CLIENT_ID_KEY, next);
  return next;
};

const clientId = getClientId();

const shuffleItems = <T,>(items: T[]) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const lobbyForLocalMode = (lobby: LobbyState, mode: AppMode): LobbyState =>
  mode === "join" ? { ...lobby, mode: "join" } : lobby;

const updateLobbyPlayerById = (
  lobby: LobbyState,
  playerId: string,
  updates: { name?: string; color?: string; ready?: boolean }
): LobbyState => ({
  ...lobby,
  players: lobby.players.map((player) => (player.playerId === playerId ? { ...player, ...updates } : player))
});

const getSessionPlayerIdForLobbyPlayer = (session: GameSession, lobbyPlayer?: LobbyState["players"][number]) => {
  if (!lobbyPlayer) return "";
  if (session.players.some((player) => player.id === lobbyPlayer.playerId)) return lobbyPlayer.playerId;
  return session.players[(lobbyPlayer.seatNumber ?? 1) - 1]?.id ?? "";
};

const ensurePlayerCount = (session: GameSession, count: 2 | 3 | 4): GameSession => {
  const templatePlayers = createPlayers(count);
  const players = templatePlayers.map((templatePlayer, index) => {
    const existing = session.players[index];
    return existing ? { ...templatePlayer, ...existing } : templatePlayer;
  });
  const playerIds = new Set(players.map((player) => player.id));
  return {
    ...session,
    players,
    activePlayerId: playerIds.has(session.activePlayerId) ? session.activePlayerId : players[0].id,
    cardInstances: session.cardInstances.map((card) =>
      card.ownerPlayerId && !playerIds.has(card.ownerPlayerId)
        ? { ...card, ownerPlayerId: undefined, location: "board" as const }
        : card
    )
  };
};

const ensureSessionPlayersForLobby = (session: GameSession, lobby: LobbyState): GameSession => {
  const templatePlayers = createPlayers(lobby.maxPlayers);
  const lobbyPlayersBySeat = new Map(
    lobby.players.map((player, index) => [player.seatNumber ?? ((index + 1) as 1 | 2 | 3 | 4), player])
  );
  const ownerIdByPreviousId = new Map<string, string>();
  const players = templatePlayers.map((templatePlayer, index) => {
    const existing = session.players[index];
    const lobbyPlayer = lobbyPlayersBySeat.get((index + 1) as 1 | 2 | 3 | 4);
    const nextPlayer = lobbyPlayer
      ? {
          ...templatePlayer,
          id: lobbyPlayer.playerId,
          name: lobbyPlayer.name,
          color: lobbyPlayer.color,
          handCardInstanceIds: existing?.handCardInstanceIds ?? []
        }
      : existing
        ? { ...templatePlayer, ...existing }
        : templatePlayer;
    if (existing && existing.id !== nextPlayer.id) ownerIdByPreviousId.set(existing.id, nextPlayer.id);
    return nextPlayer;
  });
  const playerIds = new Set(players.map((player) => player.id));
  const nextActivePlayerId = ownerIdByPreviousId.get(session.activePlayerId) ?? session.activePlayerId;
  return {
    ...session,
    players,
    activePlayerId: playerIds.has(nextActivePlayerId) ? nextActivePlayerId : players[0].id,
    cardInstances: session.cardInstances.map((card) => {
      const mappedOwnerId = card.ownerPlayerId ? ownerIdByPreviousId.get(card.ownerPlayerId) ?? card.ownerPlayerId : undefined;
      return mappedOwnerId && playerIds.has(mappedOwnerId)
        ? { ...card, ownerPlayerId: mappedOwnerId }
        : card.ownerPlayerId
          ? { ...card, ownerPlayerId: undefined, location: "board" as const }
          : card;
    })
  };
};

const needsPlayerSessionSync = (current: GameSession, next: GameSession) =>
  current.activePlayerId !== next.activePlayerId ||
  current.players.length !== next.players.length ||
  current.players.some((player, index) => {
    const nextPlayer = next.players[index];
    return !nextPlayer || player.id !== nextPlayer.id || player.name !== nextPlayer.name || player.color !== nextPlayer.color;
  }) ||
  current.cardInstances.some((card, index) => {
    const nextCard = next.cardInstances[index];
    return !nextCard || card.ownerPlayerId !== nextCard.ownerPlayerId || card.location !== nextCard.location;
  });

export default function App() {
  const [assets, setAssets] = React.useState<AssetTemplate[]>([]);
  const [deckTemplates, setDeckTemplates] = React.useState<DeckTemplate[]>([]);
  const [savedGames, setSavedGames] = React.useState<SavedGameRecord[]>([]);
  const [session, dispatchBase] = React.useReducer(gameReducer, createEmptySession(2, "Local Session"));
  const sessionRef = React.useRef(session);
  const assetsRef = React.useRef(assets);
  const deckTemplatesRef = React.useRef(deckTemplates);
  const [modal, setModal] = React.useState<ModalName>();
  const [error, setError] = React.useState("");
  const [confirm, setConfirm] = React.useState<{ title: string; message: string; onConfirm: () => void }>();
  const [mode, setMode] = React.useState<AppMode>("local");
  const [networkStatus, setNetworkStatus] = React.useState<NetworkStatus>("idle");
  const [lobby, setLobby] = React.useState<LobbyState>(() => createLobby(clientId, "local", 2));
  const [pendingInvites, setPendingInvites] = React.useState<PendingInvite[]>([]);
  const [selectedInvitePeerId, setSelectedInvitePeerId] = React.useState("");
  const [answerCode, setAnswerCode] = React.useState("");
  const [peers, setPeers] = React.useState<PeerConnectionStatus[]>([]);
  // In multiplayer (join) mode, the host sends us our assigned playerId via PLAYER_ASSIGN.
  const [myAssignedPlayerId, setMyAssignedPlayerId] = React.useState<string>(() => getStoredValue(ASSIGNED_PLAYER_KEY));
  const hostSync = React.useRef<HostSync | null>(null);
  const clientSync = React.useRef<ClientSync | null>(null);
  const modeRef = React.useRef<AppMode>("local");
  const undoHistoryRef = React.useRef<UndoEntry[]>([]);
  const lobbyRef = React.useRef(lobby);
  const lastHostRefreshAtRef = React.useRef(0);
  const requestedMissingAssetAtRef = React.useRef<Map<string, number>>(new Map());
  const boardViewCenterRef = React.useRef({ x: 600, y: 360 });
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [activeLayerId, setActiveLayerId] = React.useState<string>(LAYER_IDS.cards);
  const [activeCanvasId, setActiveCanvasId] = React.useState<string>(MAIN_CANVAS_ID);
  const [boardZoom, setBoardZoom] = React.useState(1);
  const [boardRotation, setBoardRotation] = React.useState(0);
  const [localSelectedObjectId, setLocalSelectedObjectId] = React.useState<string | undefined>();
  const [perspectivePlayerId, setPerspectivePlayerId] = React.useState<string>(session.activePlayerId);

  const updateBoardViewCenter = React.useCallback((point: { x: number; y: number }) => {
    boardViewCenterRef.current = point;
  }, []);

  const centeredPlacement = (width: number, height: number) => ({
    x: Math.round(boardViewCenterRef.current.x - width / 2),
    y: Math.round(boardViewCenterRef.current.y - height / 2)
  });

  const sessionForLocalUi = React.useMemo(
    () => ({ ...session, selectedObjectId: localSelectedObjectId }),
    [localSelectedObjectId, session]
  );

  const requestMissingAssets = React.useCallback(() => {
    if (mode === "local") return;
    const availableAssetIds = new Set(assets.map((asset) => asset.id));
    const now = Date.now();
    const missingAssetIds = getRequiredAssetIdsForSession(session, deckTemplates).filter((assetId) => {
      if (availableAssetIds.has(assetId)) return false;
      const lastRequestedAt = requestedMissingAssetAtRef.current.get(assetId) ?? 0;
      return now - lastRequestedAt >= MISSING_ASSET_RETRY_MS;
    });
    if (missingAssetIds.length === 0) return;
    const uniqueMissingAssetIds = [...new Set(missingAssetIds)];
    uniqueMissingAssetIds.forEach((assetId) => requestedMissingAssetAtRef.current.set(assetId, now));
    const request: MultiplayerMessage = { kind: "ASSET_REQUEST", assetIds: uniqueMissingAssetIds };
    if (mode === "host") hostSync.current?.broadcast(request);
    if (mode === "join") clientSync.current?.send(request);
  }, [assets, deckTemplates, mode, session]);

  const placedAssetIds = React.useMemo(() => {
    const ids: string[] = [];
    if (session.boardAssetId) ids.push(session.boardAssetId);
    session.placedImageInstances
      .filter((image) => !image.canvasId || image.canvasId === activeCanvasId)
      .forEach((image) => ids.push(image.assetId));
    session.tokenInstances
      .filter((token) => (!token.canvasId || token.canvasId === activeCanvasId) && token.assetId)
      .forEach((token) => token.assetId && ids.push(token.assetId));
    session.cardInstances
      .filter((card) => card.location === "board" && (!card.canvasId || card.canvasId === activeCanvasId))
      .forEach((card) => {
        ids.push(card.assetId);
        if (card.backAssetId) ids.push(card.backAssetId);
      });
    return ids;
  }, [activeCanvasId, session.boardAssetId, session.cardInstances, session.placedImageInstances, session.tokenInstances]);

  // Keep activeLayerId valid when layers change (e.g. after loading a session)
  React.useEffect(() => {
    if (session.layers.length > 0 && !session.layers.find((l) => l.id === activeLayerId)) {
      const defaultLayer = session.layers.find((layer) => layer.id === LAYER_IDS.default);
      const topLayer = session.layers.reduce((best, l) => (l.order > best.order ? l : best), session.layers[0]);
      setActiveLayerId(defaultLayer?.id ?? topLayer.id);
    }
  }, [session.layers, activeLayerId]);

  React.useEffect(() => {
    if (session.canvasTabs.length > 0 && !session.canvasTabs.find((canvas) => canvas.id === activeCanvasId)) {
      setActiveCanvasId(session.canvasTabs[0].id);
    }
  }, [session.canvasTabs, activeCanvasId]);

  React.useEffect(() => {
    if (!session.players.find((player) => player.id === perspectivePlayerId)) {
      setPerspectivePlayerId(session.activePlayerId);
    }
  }, [session.players, session.activePlayerId, perspectivePlayerId]);

  React.useEffect(() => {
    if (mode !== "local" && mode !== "host") return;
    const nextSession = mode === "local" ? ensurePlayerCount(session, lobby.maxPlayers) : ensureSessionPlayersForLobby(session, lobby);
    if (!needsPlayerSessionSync(session, nextSession)) return;
    dispatchBase(createAction("LOAD_SESSION", nextSession, clientId));
    if (mode === "host") {
      hostSync.current?.broadcast({ kind: "FULL_STATE_SYNC", session: nextSession, assets: [], deckTemplates: [] });
    }
  }, [lobby, mode, session]);

  React.useEffect(() => {
    sessionRef.current = session;
    saveCurrentSession(session).catch(() => setError("Failed to auto-save current session."));
  }, [session]);

  React.useEffect(() => {
    if (mode !== "host" || networkStatus !== "connected") return;
    const interval = window.setInterval(() => {
      const currentSession = sessionRef.current;
      if (currentSession.lastUpdatedAt <= lastHostRefreshAtRef.current) return;
      lastHostRefreshAtRef.current = currentSession.lastUpdatedAt;
      hostSync.current?.broadcast({ kind: "FULL_STATE_SYNC", session: currentSession, assets: [], deckTemplates: [] });
    }, 500);
    return () => window.clearInterval(interval);
  }, [mode, networkStatus]);

  React.useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  React.useEffect(() => {
    deckTemplatesRef.current = deckTemplates;
  }, [deckTemplates]);

  React.useEffect(() => {
    requestMissingAssets();
    if (mode === "local") return;
    const interval = window.setInterval(requestMissingAssets, MISSING_ASSET_RETRY_MS);
    return () => window.clearInterval(interval);
  }, [mode, requestMissingAssets]);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  React.useEffect(() => {
    if (myAssignedPlayerId) setStoredValue(ASSIGNED_PLAYER_KEY, myAssignedPlayerId);
  }, [myAssignedPlayerId]);

  // Keep lobbyRef current so applyHostAction can validate without stale closure.
  React.useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  // The playerId for the local client within the lobby.
  // This can differ from the current session id until a hosted game is started.
  const localLobbyPlayerId = React.useMemo(() => {
    if (mode === "join") return myAssignedPlayerId;
    return lobby.players.find((p) => p.clientId === clientId)?.playerId ?? "";
  }, [mode, lobby, myAssignedPlayerId]);

  // The playerId for the local client within the current game session.
  // - Local mode: follows perspectivePlayerId so the user can switch freely for testing.
  // - Host mode: the host is always players[0] in the lobby.
  // - Join mode: assigned by the host via PLAYER_ASSIGN message.
  const localPlayerId = React.useMemo(() => {
    if (mode === "local") return perspectivePlayerId;
    const localLobbyPlayer = lobby.players.find((p) => p.playerId === localLobbyPlayerId);
    return getSessionPlayerIdForLobbyPlayer(session, localLobbyPlayer);
  }, [mode, perspectivePlayerId, lobby, localLobbyPlayerId, session.players]);

  const updateLocalLobbyPlayer = (updates: { name?: string; color?: string; ready?: boolean }) => {
    const targetPlayerId = localLobbyPlayerId || lobby.players.find((player) => player.clientId === clientId)?.playerId;
    if (!targetPlayerId) return;
    const nextLobby = updateLobbyPlayerById(lobbyRef.current, targetPlayerId, updates);
    lobbyRef.current = nextLobby;
    setLobby(nextLobby);
    if (mode === "join") {
      clientSync.current?.send({ kind: "LOBBY_PLAYER_UPDATE", playerId: targetPlayerId, updates });
    }
    if (mode === "host") {
      hostSync.current?.broadcast({ kind: "LOBBY_SYNC", lobby: nextLobby });
    }
  };

  const updateMaxPlayers = (maxPlayers: 2 | 3 | 4) => {
    const nextLobby = {
      ...lobbyRef.current,
      maxPlayers,
      players: lobbyRef.current.players.filter((player) => (player.seatNumber ?? 1) <= maxPlayers)
    };
    lobbyRef.current = nextLobby;
    setLobby(nextLobby);
    if (mode === "host") {
      hostSync.current?.broadcast({ kind: "LOBBY_SYNC", lobby: nextLobby });
    }
  };

  React.useEffect(() => {
    Promise.all([getAssets(), getDeckTemplates(), getSavedGames(), loadCurrentSession()])
      .then(([loadedAssets, loadedDecks, loadedGames, current]) => {
        setAssets(loadedAssets);
        setDeckTemplates(loadedDecks);
        setSavedGames(loadedGames);
        if (current) dispatchBase(createAction("LOAD_SESSION", current, clientId));
      })
      .catch(() => setError("IndexedDB unavailable or failed to load saved data."));
  }, []);

  const persistAssets = (nextAssets: AssetTemplate[], assetsToSave?: AssetTemplate[]) => {
    const previousAssets = new Map(assetsRef.current.map((asset) => [asset.id, asset]));
    const changedAssets = assetsToSave ?? nextAssets.filter((asset) => previousAssets.get(asset.id) !== asset);
    assetsRef.current = nextAssets;
    setAssets(nextAssets);
    changedAssets.forEach((asset) => saveAsset(asset).catch(() => setError("Failed to save asset.")));
  };

  const addAssets = (incoming: AssetTemplate[], sync = true) => {
    if (incoming.length === 0) return;
    incoming.forEach((asset) => requestedMissingAssetAtRef.current.delete(asset.id));
    const assetsToSync = incoming.filter((asset) => {
      const existing = assetsRef.current.find((item) => item.id === asset.id);
      return !existing || !existing.sharedInSession || !asset.sharedInSession;
    });
    const merged = mergeById(assetsRef.current, incoming);
    persistAssets(merged, incoming);
    if (!sync || assetsToSync.length === 0) return;
    try {
      if (modeRef.current === "host") hostSync.current?.broadcast({ kind: "ASSET_SYNC", assets: assetsToSync });
      if (modeRef.current === "join") clientSync.current?.send({ kind: "ASSET_SYNC", assets: assetsToSync });
    } catch {
      setError("Asset was placed locally, but multiplayer asset sync failed. Try Sync Full Session after the connection catches up.");
    }
  };

  const persistDeckTemplate = (deck: DeckTemplate, sync = true) => {
    const nextDecks = mergeById(deckTemplatesRef.current, [deck]);
    deckTemplatesRef.current = nextDecks;
    setDeckTemplates(nextDecks);
    saveDeckTemplate(deck).catch(() => setError("Failed to save deck template."));
    if (!sync) return;
    if (modeRef.current === "host") hostSync.current?.broadcast({ kind: "DECK_TEMPLATE_SYNC", deckTemplates: [deck] });
    if (modeRef.current === "join") clientSync.current?.send({ kind: "DECK_TEMPLATE_SYNC", deckTemplates: [deck] });
  };

  const sendRequestedAssets = (assetIds: string[], peerId?: string) => {
    const requested = new Set(assetIds.filter(Boolean));
    if (requested.size === 0) return;
    const responseAssets = assetsRef.current
      .filter((asset) => requested.has(asset.id))
      .map((asset) => ({ ...asset, sharedInSession: true }));
    if (responseAssets.length === 0) return;
    if (modeRef.current === "host") {
      if (peerId) hostSync.current?.sendToPeer(peerId, { kind: "ASSET_SYNC", assets: responseAssets });
      else hostSync.current?.broadcast({ kind: "ASSET_SYNC", assets: responseAssets });
    }
    if (modeRef.current === "join") {
      clientSync.current?.send({ kind: "ASSET_SYNC", assets: responseAssets });
    }
  };

  const recordUndoSnapshot = (actorId: string, snapshot: GameSession, action: GameAction) => {
    undoHistoryRef.current = [...undoHistoryRef.current.slice(-99), { actorId, before: snapshot, action }];
  };

  const undoLastActionFor = (actorId: string) => {
    const history = undoHistoryRef.current;
    let undoIndex = -1;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index].actorId === actorId) {
        undoIndex = index;
        break;
      }
    }
    if (undoIndex < 0) {
      setError("No previous action to undo.");
      return;
    }
    let replayedSession = history[undoIndex].before;
    const replayedTail: UndoEntry[] = [];
    for (const entry of history.slice(undoIndex + 1)) {
      const before = replayedSession;
      replayedSession = gameReducer(replayedSession, entry.action);
      replayedTail.push({ ...entry, before });
    }
    undoHistoryRef.current = [...history.slice(0, undoIndex), ...replayedTail];
    sessionRef.current = replayedSession;
    setLocalSelectedObjectId(undefined);
    dispatchBase(createAction("LOAD_SESSION", replayedSession, clientId));
    if (modeRef.current === "host") {
      hostSync.current?.broadcast({ kind: "FULL_STATE_SYNC", session: replayedSession, assets: [], deckTemplates: [] });
    }
  };

  const undoLastAction = () => {
    if (mode === "join") {
      clientSync.current?.send({ kind: "UNDO_REQUEST" });
      return;
    }
    undoLastActionFor(clientId);
  };

  const sendFullStateToPeer = (peerId: string) => {
    const currentSession = sessionRef.current;
    const currentDeckTemplates = deckTemplatesRef.current;
    hostSync.current?.sendToPeer(peerId, { kind: "LOBBY_SYNC", lobby: lobbyRef.current });
    const lobbyPlayer = lobbyRef.current.players.find((player) => player.clientId === peerId);
    if (lobbyPlayer) hostSync.current?.sendToPeer(peerId, { kind: "PLAYER_ASSIGN", playerId: lobbyPlayer.playerId });
    hostSync.current?.syncFullStateToPeer(
      peerId,
      currentSession,
      getAssetsForSession(currentSession, assetsRef.current, currentDeckTemplates),
      currentDeckTemplates
    );
  };

  const refreshFromHost = () => {
    if (mode === "host") {
      hostSync.current?.syncFullState(sessionRef.current, getAssetsForSession(sessionRef.current, assetsRef.current, deckTemplatesRef.current), deckTemplatesRef.current);
      return;
    }
    if (mode !== "join" || !clientSync.current) {
      setError("Join a multiplayer host before refreshing from host.");
      return;
    }
    requestedMissingAssetAtRef.current.clear();
    clientSync.current.send({ kind: "FULL_STATE_REQUEST" });
    const availableAssetIds = new Set(assetsRef.current.map((asset) => asset.id));
    const missingAssetIds = getRequiredAssetIdsForSession(sessionRef.current, deckTemplatesRef.current).filter((assetId) => !availableAssetIds.has(assetId));
    if (missingAssetIds.length > 0) {
      clientSync.current.send({ kind: "ASSET_REQUEST", assetIds: [...new Set(missingAssetIds)] });
    }
  };

  const applyAction = (action: GameAction) => {
    if (mode === "join") {
      clientSync.current?.send({ kind: "ACTION", action });
      return;
    }
    recordUndoSnapshot(clientId, sessionRef.current, action);
    dispatchBase(action);
    if (mode === "host") hostSync.current?.broadcast({ kind: "ACTION", action });
  };

  React.useEffect(() => {
    if (!localSelectedObjectId) return;
    const selected = findBoardObject(session, localSelectedObjectId);
    if (!selected || (selected.layerId && selected.layerId !== activeLayerId) || (selected.canvasId && selected.canvasId !== activeCanvasId)) {
      setLocalSelectedObjectId(undefined);
    }
  }, [activeLayerId, activeCanvasId, localSelectedObjectId, session.deckInstances, session.cardInstances, session.discardPiles, session.tokenInstances, session.placedImageInstances]);

  const applyHostAction = (action: GameAction) => {
    // Validate MOVE_CARD_TO_BOARD: only the player who owns the card may place it from their hand.
    if (action.type === "MOVE_CARD_TO_BOARD") {
      const { cardId } = action.payload as { cardId: string };
      const requesterLobbyPlayer = lobbyRef.current.players.find((p) => p.clientId === action.clientId);
      if (requesterLobbyPlayer) {
        const ownerId = getSessionPlayerIdForLobbyPlayer(sessionRef.current, requesterLobbyPlayer);
        const owner = sessionRef.current.players.find((p) => p.id === ownerId);
        const isInRequestersHand = Boolean(owner?.handCardInstanceIds.includes(cardId));
        const isInDiscard = sessionRef.current.discardPiles.some((pile) => pile.cardInstanceIds.includes(cardId));
        if (!isInRequestersHand && !isInDiscard) {
          // Reject: card is neither in requester's hand nor a public discard pile.
          return;
        }
      }
    }
    const normalizedAction =
      action.type === "MOVE_DISCARD_TO_DECK" && (action.payload as { position?: string; shuffledCardAssetIds?: string[] }).position === "shuffle"
        ? {
            ...action,
            payload: {
              ...(action.payload as object),
              shuffledCardAssetIds:
                (action.payload as { shuffledCardAssetIds?: string[] }).shuffledCardAssetIds ??
                getShuffledDiscardDeckAssetIds(
                  (action.payload as { discardPileId: string }).discardPileId,
                  (action.payload as { deckInstanceId: string }).deckInstanceId
                )
            }
          }
        : action;
    const resolved = normalizedAction.type === "DRAW_CARD" ? resolveDrawAction(sessionRef.current, deckTemplatesRef.current, normalizedAction as GameAction<{ deckInstanceId: string; playerId: string; chosenCardIndex?: number; drawMode?: "top" | "random" }>) : normalizedAction;
    if (!resolved) {
      setError("Deck is empty or draw is invalid.");
      return;
    }
    recordUndoSnapshot(action.clientId || clientId, sessionRef.current, resolved);
    dispatchBase(resolved);
    hostSync.current?.broadcast({ kind: "ACTION", action: resolved });
  };

  const loadSyncedState = (nextSession: GameSession, nextAssets: AssetTemplate[], nextDecks: DeckTemplate[]) => {
    addAssets(nextAssets, false);
    nextDecks.forEach((deck) => saveDeckTemplate(deck).catch(() => undefined));
    const mergedDecks = mergeById(deckTemplatesRef.current, nextDecks);
    deckTemplatesRef.current = mergedDecks;
    setDeckTemplates(mergedDecks);
    dispatchBase(createAction("FULL_STATE_SYNC", nextSession, clientId));
  };

  const handleNetworkMessage = (message: MultiplayerMessage, peerId?: string) => {
    if (message.kind === "UNDO_REQUEST" && modeRef.current === "host" && peerId) {
      undoLastActionFor(peerId);
    }
    if (message.kind === "FULL_STATE_REQUEST" && modeRef.current === "host" && peerId) {
      sendFullStateToPeer(peerId);
    }
    if (message.kind === "ACTION") {
      const action = modeRef.current === "host" && peerId ? { ...message.action, clientId: peerId } : message.action;
      if (modeRef.current === "host") applyHostAction(action);
      else dispatchBase(action);
    }
    if (message.kind === "FULL_STATE_SYNC") loadSyncedState(message.session, message.assets, message.deckTemplates);
    if (message.kind === "ASSET_SYNC") addAssets(message.assets, modeRef.current === "host");
    if (message.kind === "ASSET_REQUEST") sendRequestedAssets(message.assetIds, peerId);
    if (message.kind === "ASSET_DELETE") {
      setAssets((current) => current.filter((asset) => asset.id !== message.assetId));
      deleteAsset(message.assetId).catch(() => undefined);
    }
    if (message.kind === "DECK_TEMPLATE_SYNC") {
      const nextDecks = mergeById(deckTemplatesRef.current, message.deckTemplates);
      deckTemplatesRef.current = nextDecks;
      setDeckTemplates(nextDecks);
      message.deckTemplates.forEach((deck) => saveDeckTemplate(deck).catch(() => undefined));
      if (modeRef.current === "host") hostSync.current?.broadcast({ kind: "DECK_TEMPLATE_SYNC", deckTemplates: message.deckTemplates });
    }
    if (message.kind === "LOBBY_PLAYER_UPDATE" && modeRef.current === "host" && peerId) {
      const player = lobbyRef.current.players.find((item) => item.playerId === message.playerId);
      if (player?.clientId !== peerId) return;
      const nextLobby = updateLobbyPlayerById(lobbyRef.current, message.playerId, message.updates);
      lobbyRef.current = nextLobby;
      setLobby(nextLobby);
      hostSync.current?.broadcast({ kind: "LOBBY_SYNC", lobby: nextLobby });
    }
    if (message.kind === "LOBBY_SYNC") {
      const nextLobby = lobbyForLocalMode(message.lobby, modeRef.current);
      lobbyRef.current = nextLobby;
      setLobby(nextLobby);
    }
    if (message.kind === "START_GAME") {
      setMode("join");
      const nextLobby = lobbyForLocalMode(message.lobby, "join");
      lobbyRef.current = nextLobby;
      setLobby(nextLobby);
      loadSyncedState(message.session, message.assets, message.deckTemplates);
    }
    if (message.kind === "PLAYER_ASSIGN") {
      setMyAssignedPlayerId(message.playerId);
      setPerspectivePlayerId(message.playerId);
    }
    if (message.kind === "ERROR") setError(message.message);
  };

  const placeBoardImage = (assetId: string, width = 1400, height = 400) => {
    const asset = assets.find((item) => item.id === assetId);
    if (asset) addAssets([{ ...asset, sharedInSession: true }]);
    const { x, y } = centeredPlacement(width, height);
    const id = crypto.randomUUID();
    setLocalSelectedObjectId(id);
    applyAction(createAction("PLACE_IMAGE", { id, assetId, x, y, width, height, layerId: LAYER_IDS.board, canvasId: activeCanvasId }, clientId));
    setModal(undefined);
  };

  const placeImage = (assetId: string, width = 200, height = 280) => {
    const asset = assets.find((item) => item.id === assetId);
    if (asset) addAssets([{ ...asset, sharedInSession: true }]);
    const { x, y } = centeredPlacement(width, height);
    const id = crypto.randomUUID();
    setLocalSelectedObjectId(id);
    applyAction(createAction("PLACE_IMAGE", { id, assetId, x, y, width, height, layerId: activeLayerId, canvasId: activeCanvasId }, clientId));
    setModal(undefined);
  };

  const createTokenFromAsset = (assetId: string, width = 100, height = 100, shape: TokenShape = "square") => {
    const asset = assets.find((item) => item.id === assetId);
    if (asset) addAssets([{ ...asset, sharedInSession: true }]);
    const { x, y } = centeredPlacement(width, height);
    const id = crypto.randomUUID();
    setLocalSelectedObjectId(id);
    applyAction(createAction("CREATE_TOKEN", { id, assetId, shape, x, y, width, height, layerId: LAYER_IDS.tokens, canvasId: activeCanvasId }, clientId));
    setModal(undefined);
  };

  const createGenericToken = (width = 100, height = 100, shape: TokenShape = "square") => {
    const { x, y } = centeredPlacement(width, height);
    const id = crypto.randomUUID();
    setLocalSelectedObjectId(id);
    applyAction(createAction("CREATE_TOKEN", { id, label: "1", color: "hsl(45 93% 60%)", shape, x, y, width, height, layerId: LAYER_IDS.tokens, canvasId: activeCanvasId }, clientId));
    setModal(undefined);
  };

  const createDiscardPile = () => {
    const nameInput = window.prompt("Discard pile name", "Discard");
    if (nameInput === null) return;
    const name = nameInput.trim();
    const { x, y } = centeredPlacement(112, 144);
    const id = crypto.randomUUID();
    setLocalSelectedObjectId(id);
    applyAction(createAction("CREATE_DISCARD_PILE", { id, name: name || "Discard", x, y, layerId: activeLayerId, canvasId: activeCanvasId }, clientId));
  };

  const addDeckInstance = (deck: DeckTemplate) => {
    const deckAssetIds = new Set([...deck.cardAssetIds, ...(deck.defaultBackAssetId ? [deck.defaultBackAssetId] : []), ...Object.values(deck.cardBackAssetIds ?? {})]);
    addAssets(assets.filter((asset) => deckAssetIds.has(asset.id)).map((asset) => ({ ...asset, sharedInSession: true })));
    const { x, y } = centeredPlacement(96, 136);
    const id = crypto.randomUUID();
    setLocalSelectedObjectId(id);
    applyAction(createAction("ADD_DECK_INSTANCE", { id, deckTemplateId: deck.id, name: deck.name, cardAssetIds: shuffleItems(deck.cardAssetIds), x, y, backAssetId: deck.defaultBackAssetId, layerId: activeLayerId, canvasId: activeCanvasId }, clientId));
    setModal(undefined);
  };

  const removeDeckTemplate = (deckId: string) => {
    if (session.deckInstances.some((deck) => deck.deckTemplateId === deckId)) {
      setError("Remove deck instances from the board before deleting this saved deck.");
      return false;
    }
    setDeckTemplates((current) => current.filter((deck) => deck.id !== deckId));
    deleteDeckTemplate(deckId).catch(() => setError("Failed to delete deck template."));
    return true;
  };

  const getAssetUsage = (assetId: string) => {
    const usage = new Set<string>();
    if (session.boardAssetId === assetId) usage.add("board background");
    if (session.deckInstances.some((deck) => deck.remainingCardAssetIds.includes(assetId) || deck.drawnCardAssetIds.includes(assetId))) usage.add("deck on table");
    if (session.cardInstances.some((card) => card.assetId === assetId || card.backAssetId === assetId)) usage.add("cards on table");
    if (session.tokenInstances.some((token) => token.assetId === assetId)) usage.add("tokens on table");
    if (session.placedImageInstances.some((image) => image.assetId === assetId)) usage.add("placed images");
    if (
      deckTemplates.some(
        (deck) =>
          deck.defaultBackAssetId === assetId ||
          deck.cardAssetIds.includes(assetId) ||
          Object.values(deck.cardBackAssetIds ?? {}).includes(assetId)
      )
    ) {
      usage.add("saved decks");
    }
    return [...usage];
  };

  const deleteAssetFromLibrary = (assetId: string) => {
    const usage = getAssetUsage(assetId);
    const run = () => {
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      setDeckTemplates((current) => {
        const updated = current.map((deck) => {
          const nextBacks = Object.fromEntries(
            Object.entries(deck.cardBackAssetIds ?? {}).filter(([cardAssetId, backAssetId]) => cardAssetId !== assetId && backAssetId !== assetId)
          );
          return {
            ...deck,
            cardAssetIds: deck.cardAssetIds.filter((id) => id !== assetId),
            defaultBackAssetId: deck.defaultBackAssetId === assetId ? undefined : deck.defaultBackAssetId,
            cardBackAssetIds: Object.keys(nextBacks).length > 0 ? nextBacks : undefined,
            updatedAt: Date.now()
          };
        });
        updated.forEach((deck) => saveDeckTemplate(deck).catch(() => setError("Failed to update deck template.")));
        if (mode === "host") hostSync.current?.broadcast({ kind: "DECK_TEMPLATE_SYNC", deckTemplates: updated });
        return updated;
      });
      deleteAsset(assetId).catch(() => setError("Failed to delete asset."));
      if (mode === "host") hostSync.current?.broadcast({ kind: "ASSET_DELETE", assetId });
      setConfirm(undefined);
    };
    if (usage.length > 0) {
      setConfirm({
        title: "Delete Asset",
        message: `Delete this asset from the library? It is currently used in ${usage.join(", ")}. Saved deck references will be removed, but objects already on the table may show as missing until removed.`,
        onConfirm: run
      });
      return;
    }
    run();
  };

  // Layer helpers
  const getFallbackLayerId = (excludeLayerId: string): string => {
    if (excludeLayerId !== LAYER_IDS.default && session.layers.some((layer) => layer.id === LAYER_IDS.default)) {
      return LAYER_IDS.default;
    }
    const other = session.layers.find((l) => l.id !== excludeLayerId);
    return other?.id ?? LAYER_IDS.default;
  };

  const createLayer = () =>
    applyAction(createAction("CREATE_LAYER", { id: crypto.randomUUID(), name: "New Layer" }, clientId));

  const deleteLayer = (layerId: string) => {
    if (layerId === LAYER_IDS.default) return;
    const fallbackLayerId = getFallbackLayerId(layerId);
    applyAction(createAction("DELETE_LAYER", { layerId, fallbackLayerId }, clientId));
    if (activeLayerId === layerId) setActiveLayerId(fallbackLayerId);
  };

  const moveLayerUp = (layerId: string) => {
    const sorted = [...session.layers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((l) => l.id === layerId);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    applyAction(createAction("REORDER_LAYERS", { layerIds: reordered.map((l) => l.id) }, clientId));
  };

  const moveLayerDown = (layerId: string) => {
    const sorted = [...session.layers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((l) => l.id === layerId);
    if (idx <= 0) return;
    const reordered = [...sorted];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    applyAction(createAction("REORDER_LAYERS", { layerIds: reordered.map((l) => l.id) }, clientId));
  };

  const createCanvas = () => {
    const id = crypto.randomUUID();
    applyAction(createAction("CREATE_CANVAS", { id, name: `Canvas ${session.canvasTabs.length + 1}` }, clientId));
    setActiveCanvasId(id);
  };

  const deleteCanvas = (canvasId: string) => {
    if (session.canvasTabs.length <= 1) return;
    const fallbackCanvasId = session.canvasTabs.find((canvas) => canvas.id !== canvasId)?.id ?? MAIN_CANVAS_ID;
    applyAction(createAction("DELETE_CANVAS", { canvasId, fallbackCanvasId }, clientId));
    if (activeCanvasId === canvasId) setActiveCanvasId(fallbackCanvasId);
  };

  const drawDeck = (deckInstanceId: string, playerIdOverride?: string, drawMode: "top" | "random" = "top", chosenCardIndex?: number) => {
    const playerId = playerIdOverride || (mode === "local" ? sessionRef.current.activePlayerId : localPlayerId);
    if (!playerId) {
      setError("You have not been assigned a player slot yet.");
      return;
    }
    const raw = createAction("DRAW_CARD", { deckInstanceId, playerId, drawMode, chosenCardIndex }, clientId);
    if (mode === "join") {
      clientSync.current?.send({ kind: "ACTION", action: raw });
      return;
    }
    const resolved = resolveDrawAction(sessionRef.current, deckTemplatesRef.current, raw);
    if (!resolved) {
      setError("Deck is empty.");
      return;
    }
    applyAction(resolved);
  };

  const getShuffledDiscardDeckAssetIds = (discardPileId: string, deckInstanceId: string) => {
    const currentSession = sessionRef.current;
    const deck = currentSession.deckInstances.find((item) => item.id === deckInstanceId);
    const pile = currentSession.discardPiles.find((item) => item.id === discardPileId);
    if (!deck || !pile) return undefined;
    const discardAssetIds = pile.cardInstanceIds
      .map((cardId) => currentSession.cardInstances.find((card) => card.id === cardId)?.assetId)
      .filter((assetId): assetId is string => Boolean(assetId));
    return shuffleItems([...deck.remainingCardAssetIds, ...discardAssetIds]);
  };

  const moveDiscardToDeck = (discardPileId: string, deckInstanceId: string, position: "top" | "bottom" | "shuffle") => {
    const payload = {
      discardPileId,
      deckInstanceId,
      position,
      ...(position === "shuffle" && mode !== "join"
        ? { shuffledCardAssetIds: getShuffledDiscardDeckAssetIds(discardPileId, deckInstanceId) }
        : {})
    };
    setLocalSelectedObjectId(deckInstanceId);
    applyAction(createAction("MOVE_DISCARD_TO_DECK", payload, clientId));
  };

  const moveObject = (objectType: AnyBoardObject["type"], objectId: string, x: number, y: number) =>
    applyAction(createAction("MOVE_OBJECT", { objectType, objectId, x, y, canvasId: activeCanvasId }, clientId));

  const rotateObject = (object: AnyBoardObject, rotation: number) =>
    applyAction(createAction("ROTATE_OBJECT", { objectType: object.type, objectId: object.id, rotation }, clientId));

  const resizeObject = (object: AnyBoardObject, width: number, height: number) =>
    applyAction(createAction("RESIZE_OBJECT", { objectType: object.type, objectId: object.id, width: Math.max(24, width), height: Math.max(24, height) }, clientId));

  const shuffleDeck = (deckInstanceId: string) => {
    const deck = session.deckInstances.find((item) => item.id === deckInstanceId);
    if (!deck) return;
    const shuffled = [...deck.remainingCardAssetIds].sort(() => Math.random() - 0.5);
    applyAction(createAction("FULL_STATE_SYNC", { ...session, deckInstances: session.deckInstances.map((item) => (item.id === deck.id ? { ...item, remainingCardAssetIds: shuffled } : item)) }, clientId));
  };

  const resetDeck = (deckInstanceId: string) => {
    const deck = session.deckInstances.find((item) => item.id === deckInstanceId);
    const template = deckTemplates.find((item) => item.id === deck?.deckTemplateId);
    if (!deck || !template) return;
    applyAction(createAction("FULL_STATE_SYNC", { ...session, deckInstances: session.deckInstances.map((item) => (item.id === deck.id ? { ...item, remainingCardAssetIds: [...template.cardAssetIds], drawnCardAssetIds: [] } : item)) }, clientId));
  };

  const loadGameBundle = (bundle: SessionBundle) => {
    addAssets(bundle.assets);
    bundle.deckTemplates.forEach((deck) => persistDeckTemplate(deck));
    applyAction(createAction("LOAD_SESSION", bundle.session, clientId));
    setModal(undefined);
  };

  const saveGame = (name = window.prompt("Game name", session.name) ?? "") => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const bundle = createSessionBundle({ ...session, name: trimmedName }, assets, deckTemplates, { kind: "game", name: trimmedName });
    saveGameBundle(trimmedName, bundle)
      .then(() => getSavedGames().then(setSavedGames))
      .catch(() => setError("Failed to save game."));
  };

  const exportDeckTemplate = (deck: DeckTemplate) => {
    const bundle = createDeckBundle(deck, assets);
    const blob = new Blob([stringifyDeckBundle(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${deck.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.deck.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importDeckTemplate = async (file: File) => {
    try {
      const bundle = parseDeckBundle(await file.text());
      addAssets(bundle.assets);
      persistDeckTemplate(bundle.deck);
      setModal("createDeck");
      return bundle.deck;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Imported deck invalid.");
      return undefined;
    }
  };

  const exportSession = () => {
    const exportName = window.prompt("Export game name", session.name);
    if (exportName === null) return;
    const trimmedName = exportName.trim();
    if (!trimmedName) return;
    const bundle = createSessionBundle({ ...session, name: trimmedName }, assets, deckTemplates, { kind: "game", name: trimmedName });
    const blob = new Blob([stringifySessionBundle(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${trimmedName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "game"}.game.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSession = async (file: File) => {
    try {
      const bundle = parseSessionBundle(await file.text());
      addAssets(bundle.assets);
      bundle.deckTemplates.forEach((deck) => persistDeckTemplate(deck));
      applyAction(createAction("LOAD_SESSION", bundle.session, clientId));
      if (bundle.kind === "game") {
        const gameName = bundle.name ?? bundle.session.name;
        saveGameBundle(gameName, bundle).then(() => getSavedGames().then(setSavedGames)).catch(() => undefined);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Imported session invalid.");
    }
  };

  const newSession = () => {
    const run = () => {
      const next = createEmptySession(lobby.maxPlayers, "New Session");
      applyAction(createAction("LOAD_SESSION", next, clientId));
      setConfirm(undefined);
    };
    setConfirm({ title: "New Session", message: "Clear the current table? Saved assets and deck templates will stay in the library.", onConfirm: run });
  };

  const startHost = async () => {
    try {
      setMode("host");
      setNetworkStatus("signaling");
      if (!hostSync.current) {
        const host = new HostSync(handleNetworkMessage, (statuses) => {
          setPeers(statuses);
          if (statuses.some((peer) => peer.connected)) setNetworkStatus("connected");
        });
        hostSync.current = host;
        setLobby(createLobby(clientId, "host", lobby.maxPlayers));
      }
      const host = hostSync.current;
      if (!host) throw new Error("Host transport was not created.");
      const invite = await host.createInvite();
      const pendingInvite = { ...invite, createdAt: Date.now() };
      setPendingInvites((current) => [...current, pendingInvite]);
      setSelectedInvitePeerId(invite.peerId);
    } catch {
      setNetworkStatus("error");
      setError("Multiplayer connection failed.");
    }
  };

  const joinHost = async (code: string) => {
    try {
      const client = new ClientSync((message) => handleNetworkMessage(message), (connected) => setNetworkStatus(connected ? "connected" : "disconnected"));
      clientSync.current = client;
      setMode("join");
      setMyAssignedPlayerId("");
      setLobby((current) => ({ ...current, mode: "join" }));
      setNetworkStatus("connecting");
      setAnswerCode(await client.joinFromOffer(code));
    } catch (error) {
      setNetworkStatus("error");
      setError(error instanceof Error ? error.message : "Invalid offer code.");
    }
  };

  const acceptAnswer = async (code: string) => {
    try {
      const invitePeerId = selectedInvitePeerId || pendingInvites[0]?.peerId;
      if (!invitePeerId) {
        setError("Create or select a pending host offer before accepting an answer.");
        return;
      }
      const desiredSeat = await hostSync.current?.acceptAnswer(invitePeerId, code);
      setNetworkStatus("connected");
      const currentLobby = lobbyRef.current;
      if (currentLobby.players.length < currentLobby.maxPlayers && !currentLobby.players.some((player) => player.clientId === invitePeerId)) {
        const occupiedSeats = new Set(currentLobby.players.map((player, index) => player.seatNumber ?? ((index + 1) as 1 | 2 | 3 | 4)));
        const requestedSeat =
          desiredSeat && desiredSeat <= currentLobby.maxPlayers && !occupiedSeats.has(desiredSeat)
            ? desiredSeat
            : undefined;
        const fallbackSeat = ([2, 3, 4] as const).find((seat) => seat <= currentLobby.maxPlayers && !occupiedSeats.has(seat));
        const seatNumber = requestedSeat ?? fallbackSeat;
        if (!seatNumber) {
          setError("No open player seats remain.");
          return;
        }
        const newPlayer = createLobbyPlayer(invitePeerId, false, seatNumber - 1);
        const next = {
          ...currentLobby,
          players: [...currentLobby.players, newPlayer].sort((a, b) => (a.seatNumber ?? 1) - (b.seatNumber ?? 1))
        };
        lobbyRef.current = next;
        setLobby(next);
        hostSync.current?.broadcast({ kind: "LOBBY_SYNC", lobby: next });
        const nextSession = ensureSessionPlayersForLobby(sessionRef.current, next);
        if (needsPlayerSessionSync(sessionRef.current, nextSession)) {
          sessionRef.current = nextSession;
          dispatchBase(createAction("LOAD_SESSION", nextSession, clientId));
          hostSync.current?.broadcast({ kind: "FULL_STATE_SYNC", session: nextSession, assets: [], deckTemplates: [] });
        }
        // Inform the joining peer of their assigned playerId so they can identify themselves.
        hostSync.current?.sendToPeer(invitePeerId, { kind: "PLAYER_ASSIGN", playerId: newPlayer.playerId });
      }
      setPendingInvites((current) => current.filter((invite) => invite.peerId !== invitePeerId));
      setSelectedInvitePeerId((current) => {
        if (current !== invitePeerId) return current;
        const nextInvite = pendingInvites.find((invite) => invite.peerId !== invitePeerId);
        return nextInvite?.peerId ?? "";
      });
      sendFullStateToPeer(invitePeerId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid answer code.");
    }
  };

  const disconnectPeer = (peerId: string) => {
    if (mode !== "host") return;
    hostSync.current?.disconnectPeer(peerId);
    setPendingInvites((current) => current.filter((invite) => invite.peerId !== peerId));
    setSelectedInvitePeerId((current) => (current === peerId ? "" : current));
    const nextLobby = {
      ...lobbyRef.current,
      players: lobbyRef.current.players.filter((player) => player.clientId !== peerId)
    };
    lobbyRef.current = nextLobby;
    setLobby(nextLobby);
    hostSync.current?.broadcast({ kind: "LOBBY_SYNC", lobby: nextLobby });
  };

  const disconnect = () => {
    hostSync.current?.close();
    clientSync.current?.close();
    setMode("local");
    setMyAssignedPlayerId("");
    setNetworkStatus("idle");
    setPeers([]);
    setPendingInvites([]);
    setSelectedInvitePeerId("");
    setAnswerCode("");
    setLobby(createLobby(clientId, "local", 2));
  };

  return (
    <div className="app-shell">
      <Toolbar
        onOpenAssets={() => setModal("assets")}
        onSetBoard={() => setModal("setBoard")}
        onCreateDeck={() => setModal("createDeck")}
        onAddDeck={() => setModal("addDeck")}
        onAddDiscard={createDiscardPile}
        onAddToken={() => setModal("token")}
        onPlaceImage={() => setModal("placeImage")}
        onOpenMultiplayer={() => setModal("multiplayer")}
        onSaveGame={() => saveGame()}
        onLoad={() => setModal("games")}
        onExport={exportSession}
        onImport={() => importInputRef.current?.click()}
        onNewSession={newSession}
        layers={session.layers}
        activeLayerId={activeLayerId}
        onSetActiveLayer={setActiveLayerId}
      />
      <input ref={importInputRef} className="hidden-input" type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && importSession(event.target.files[0])} />
      {error && <div className="toast"><span>{error}</span><button title="Dismiss this message." onClick={() => setError("")}>Dismiss</button></div>}
      <div className="workspace">
        <aside className="left-panel">
          <LobbyPanel
            lobby={lobby}
            localClientId={clientId}
            localPlayerId={localLobbyPlayerId}
            onMaxPlayers={updateMaxPlayers}
            onName={(name) => updateLocalLobbyPlayer({ name })}
            onReady={(ready) => updateLocalLobbyPlayer({ ready })}
            onOpenMultiplayer={() => setModal("multiplayer")}
            onRefreshFromHost={refreshFromHost}
          />
          <LayersPanel
            layers={session.layers}
            activeLayerId={activeLayerId}
            defaultLayerId={LAYER_IDS.default}
            onActivate={setActiveLayerId}
            onToggleVisible={(layerId) => applyAction(createAction("TOGGLE_LAYER_VISIBILITY", { layerId }, clientId))}
            onToggleLock={(layerId) => applyAction(createAction("TOGGLE_LAYER_LOCK", { layerId }, clientId))}
            onRename={(layerId, name) => applyAction(createAction("RENAME_LAYER", { layerId, name }, clientId))}
            onDelete={deleteLayer}
            onCreate={createLayer}
            onMoveUp={moveLayerUp}
            onMoveDown={moveLayerDown}
          />
          <section className="side-section">
            <h2>Saved Decks</h2>
            {deckTemplates.map((deck) => (
              <button key={deck.id} className="deck-list-row" title={`Place shuffled ${deck.name} on the canvas.`} onClick={() => addDeckInstance(deck)}>
                <span>{deck.name}</span>
                <small>{deck.cardAssetIds.length} cards</small>
              </button>
            ))}
          </section>
          <section className="side-section">
            <h2>Asset Preview</h2>
            <div className="mini-grid">
              {assets.slice(0, 12).map((asset) => <img key={asset.id} src={asset.imageDataUrl} alt={asset.name} title={asset.name} />)}
            </div>
          </section>
        </aside>
        <BoardCanvas
          session={sessionForLocalUi}
          assets={assets}
          canvasRotation={boardRotation}
          zoom={boardZoom}
          canvasTabs={session.canvasTabs}
          activeCanvasId={activeCanvasId}
          activeLayerId={activeLayerId}
          onZoom={setBoardZoom}
          onUndo={undoLastAction}
          onCanvasRotation={setBoardRotation}
          onViewCenterChange={updateBoardViewCenter}
          onCanvas={setActiveCanvasId}
          onCreateCanvas={createCanvas}
          onDeleteCanvas={deleteCanvas}
          onRenameCanvas={(canvasId, name) => applyAction(createAction("RENAME_CANVAS", { canvasId, name }, clientId))}
          onSelect={setLocalSelectedObjectId}
          onMove={moveObject}
          onDrawDeck={drawDeck}
        />
        <ObjectInspector
          session={sessionForLocalUi}
          assets={assets}
          deckTemplates={deckTemplates}
          onRotate={rotateObject}
          onResize={resizeObject}
          onDelete={(object) => {
            setLocalSelectedObjectId(undefined);
            applyAction(createAction("DELETE_OBJECT", { objectType: object.type, objectId: object.id }, clientId));
          }}
          onDuplicate={(object) => {
            const newId = crypto.randomUUID();
            setLocalSelectedObjectId(newId);
            applyAction(createAction("DUPLICATE_OBJECT", { objectType: object.type, objectId: object.id, newId }, clientId));
          }}
          onFront={(object) => applyAction(createAction("BRING_TO_FRONT", { objectType: object.type, objectId: object.id }, clientId))}
          onBack={(object) => applyAction(createAction("SEND_TO_BACK", { objectType: object.type, objectId: object.id }, clientId))}
          onFlipCard={(cardId) => applyAction(createAction("FLIP_CARD", { cardId }, clientId))}
          onMoveCardToHand={(cardId, playerId) => {
            setLocalSelectedObjectId(undefined);
            applyAction(createAction("MOVE_CARD_TO_HAND", { cardId, playerId }, clientId));
          }}
          onMoveCardToBoard={(cardId, x, y) => {
            setLocalSelectedObjectId(cardId);
            applyAction(createAction("MOVE_CARD_TO_BOARD", { cardId, x, y, canvasId: activeCanvasId }, clientId));
          }}
          onMoveCardToDiscard={(cardId, discardPileId) => {
            setLocalSelectedObjectId(discardPileId);
            applyAction(createAction("MOVE_CARD_TO_DISCARD", { cardId, discardPileId }, clientId));
          }}
          onMoveCardToDeck={(cardId, deckInstanceId, position) => {
            setLocalSelectedObjectId(deckInstanceId);
            applyAction(createAction("MOVE_CARD_TO_DECK", { cardId, deckInstanceId, position }, clientId));
          }}
          onMoveDiscardToDeck={moveDiscardToDeck}
          onRenameDiscard={(discardPileId, name) => applyAction(createAction("RENAME_DISCARD_PILE", { discardPileId, name }, clientId))}
          onDrawDeck={drawDeck}
          onShuffleDeck={shuffleDeck}
          onResetDeck={resetDeck}
          onReorderDeckCard={(deckInstanceId, fromIndex, toIndex) => applyAction(createAction("REORDER_DECK_CARD", { deckInstanceId, fromIndex, toIndex }, clientId))}
          onAssignLayer={(object, layerId) => applyAction(createAction("ASSIGN_LAYER", { objectType: object.type, objectId: object.id, layerId }, clientId))}
          onTokenColor={(tokenId, color) => applyAction(createAction("UPDATE_TOKEN_COLOR", { tokenId, color }, clientId))}
          onTokenShape={(tokenId, shape) => applyAction(createAction("UPDATE_TOKEN_SHAPE", { tokenId, shape }, clientId))}
          onTokenLabel={(tokenId, label) => applyAction(createAction("UPDATE_TOKEN_LABEL", { tokenId, label }, clientId))}
        />
      </div>
      <PlayerHands
        session={session}
        assets={assets}
        localPlayerId={localPlayerId}
        isMultiplayer={mode !== "local"}
        perspectivePlayerId={perspectivePlayerId}
        onSetActivePlayer={(playerId) => applyAction(createAction("SET_ACTIVE_PLAYER", { playerId }, clientId))}
        onSetPerspectivePlayer={setPerspectivePlayerId}
        onMoveCardToBoard={(cardId) => {
          const card = session.cardInstances.find((item) => item.id === cardId);
          const { x, y } = centeredPlacement(card?.width ?? 200, card?.height ?? 280);
          setLocalSelectedObjectId(cardId);
          applyAction(createAction("MOVE_CARD_TO_BOARD", { cardId, x, y, canvasId: activeCanvasId }, clientId));
        }}
      />
      {(modal === "assets" || modal === "setBoard" || modal === "placeImage" || modal === "token") && (
        <AssetLibraryModal
          assets={assets}
          placedAssetIds={placedAssetIds}
          mode={modal === "setBoard" ? "setBoard" : modal === "placeImage" ? "placeImage" : modal === "token" ? "token" : "browse"}
          onClose={() => setModal(undefined)}
          onUpload={addAssets}
          onRename={(assetId, name) => persistAssets(assets.map((asset) => asset.id === assetId ? { ...asset, name, updatedAt: Date.now() } : asset))}
          onDelete={deleteAssetFromLibrary}
          onCategory={(assetId, category: AssetCategory) => persistAssets(assets.map((asset) => asset.id === assetId ? { ...asset, category, updatedAt: Date.now() } : asset))}
          onUseAsBoard={placeBoardImage}
          onUseAsToken={createTokenFromAsset}
          onCreateGenericToken={createGenericToken}
          onAddToDeck={() => setModal("createDeck")}
          onPlaceOnBoard={placeImage}
          getUsage={getAssetUsage}
          onError={setError}
        />
      )}
      {modal === "createDeck" && (
        <DeckCreatorModal
          assets={assets}
          deckTemplates={deckTemplates}
          onClose={() => setModal(undefined)}
          onUpload={addAssets}
          onSave={persistDeckTemplate}
          onDelete={removeDeckTemplate}
          onExport={exportDeckTemplate}
          onImport={importDeckTemplate}
          onError={setError}
        />
      )}
      {modal === "addDeck" && <AddDeckModal deckTemplates={deckTemplates} onClose={() => setModal(undefined)} onAdd={addDeckInstance} />}
      {modal === "games" && (
        <SessionManagerModal
          games={savedGames}
          currentSession={session}
          onClose={() => setModal(undefined)}
          onSaveGame={saveGame}
          onLoadGame={loadGameBundle}
          onDeleteGame={(id) => deleteSavedGame(id).then(() => getSavedGames().then(setSavedGames))}
        />
      )}
      <MultiplayerPanel
        open={modal === "multiplayer"}
        mode={mode}
        status={networkStatus}
        lobby={lobby}
        peers={peers}
        pendingInvites={pendingInvites}
        selectedInvitePeerId={selectedInvitePeerId}
        answerCode={answerCode}
        onClose={() => setModal(undefined)}
        onLocal={disconnect}
        onHost={startHost}
        onSelectInvite={setSelectedInvitePeerId}
        onJoin={joinHost}
        onAcceptAnswer={acceptAnswer}
        onDisconnect={disconnect}
        onDisconnectPeer={disconnectPeer}
        onSync={() => hostSync.current?.syncFullState(session, getAssetsForSession(session, assets, deckTemplates), deckTemplates)}
        onRefreshFromHost={refreshFromHost}
      />
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onCancel={() => setConfirm(undefined)} onConfirm={confirm.onConfirm} />}
    </div>
  );
}
