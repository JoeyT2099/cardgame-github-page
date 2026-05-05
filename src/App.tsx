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
import { createEmptySession, createLobby, createLobbyPlayer, createPlayers, LAYER_IDS } from "./store/initialState";
import { findBoardObject } from "./store/selectors";
import type { AssetCategory, AssetTemplate, DeckTemplate } from "./types/assets";
import type { AnyBoardObject, GameSession, SavedGameRecord, SessionBundle } from "./types/game";
import type { AppMode, LobbyState } from "./types/lobby";
import { lobbyPlayerToGamePlayer } from "./types/lobby";
import type { MultiplayerMessage, NetworkStatus, PeerConnectionStatus } from "./types/multiplayer";
import { getAssetsForSession } from "./multiplayer/assetSync";
import { ClientSync } from "./multiplayer/clientSync";
import { HostSync } from "./multiplayer/hostSync";
import { getAssets, saveAsset, deleteAsset } from "./storage/assetStorage";
import { deleteDeckTemplate, getDeckTemplates, saveDeckTemplate } from "./storage/deckStorage";
import { deleteSavedGame, getSavedGames, saveGameBundle } from "./storage/gameStorage";
import { createSessionBundle, mergeById, parseSessionBundle, stringifySessionBundle } from "./storage/importExport";
import { getSavedSessions, loadCurrentSession, saveCurrentSession, saveNamedSession, deleteSavedSession, type SavedSessionRecord } from "./storage/sessionStorage";

type ModalName = "assets" | "setBoard" | "createDeck" | "addDeck" | "placeImage" | "token" | "sessions" | "multiplayer" | undefined;

const clientId = crypto.randomUUID();

const getPerspectiveRotation = (session: GameSession, playerId: string) => {
  const index = Math.max(0, session.players.findIndex((player) => player.id === playerId));
  return (index * 360) / Math.max(1, session.players.length);
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

export default function App() {
  const [assets, setAssets] = React.useState<AssetTemplate[]>([]);
  const [deckTemplates, setDeckTemplates] = React.useState<DeckTemplate[]>([]);
  const [savedSessions, setSavedSessions] = React.useState<SavedSessionRecord[]>([]);
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
  const [offerCode, setOfferCode] = React.useState("");
  const [offerPeerId, setOfferPeerId] = React.useState("");
  const [answerCode, setAnswerCode] = React.useState("");
  const [peers, setPeers] = React.useState<PeerConnectionStatus[]>([]);
  // In multiplayer (join) mode, the host sends us our assigned playerId via PLAYER_ASSIGN.
  const [myAssignedPlayerId, setMyAssignedPlayerId] = React.useState<string>("");
  const hostSync = React.useRef<HostSync | null>(null);
  const clientSync = React.useRef<ClientSync | null>(null);
  const modeRef = React.useRef<AppMode>("local");
  const lobbyRef = React.useRef(lobby);
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [activeLayerId, setActiveLayerId] = React.useState<string>(LAYER_IDS.cards);
  const [perspectivePlayerId, setPerspectivePlayerId] = React.useState<string>(session.activePlayerId);

  // Keep activeLayerId valid when layers change (e.g. after loading a session)
  React.useEffect(() => {
    if (session.layers.length > 0 && !session.layers.find((l) => l.id === activeLayerId)) {
      const topLayer = session.layers.reduce((best, l) => (l.order > best.order ? l : best), session.layers[0]);
      setActiveLayerId(topLayer.id);
    }
  }, [session.layers, activeLayerId]);

  React.useEffect(() => {
    if (!session.players.find((player) => player.id === perspectivePlayerId)) {
      setPerspectivePlayerId(session.activePlayerId);
    }
  }, [session.players, session.activePlayerId, perspectivePlayerId]);

  React.useEffect(() => {
    sessionRef.current = session;
    saveCurrentSession(session).catch(() => setError("Failed to auto-save current session."));
  }, [session]);

  React.useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  React.useEffect(() => {
    deckTemplatesRef.current = deckTemplates;
  }, [deckTemplates]);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Keep lobbyRef current so applyHostAction can validate without stale closure.
  React.useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  // The playerId for the local client within the current game session.
  // - Local mode: follows perspectivePlayerId so the user can switch freely for testing.
  // - Host mode: the host is always players[0] in the lobby.
  // - Join mode: assigned by the host via PLAYER_ASSIGN message.
  const localPlayerId = React.useMemo(() => {
    if (mode === "local") return perspectivePlayerId;
    if (mode === "host") return lobby.players.find((p) => p.clientId === clientId)?.playerId ?? "";
    return myAssignedPlayerId;
  }, [mode, perspectivePlayerId, lobby, myAssignedPlayerId]);

  const boardPerspectivePlayerId = mode === "local" ? perspectivePlayerId : localPlayerId || perspectivePlayerId;

  const updateLocalLobbyPlayer = (updates: { name?: string; color?: string; ready?: boolean }) => {
    const targetPlayerId = localPlayerId || lobby.players.find((player) => player.clientId === clientId)?.playerId;
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

  React.useEffect(() => {
    Promise.all([getAssets(), getDeckTemplates(), getSavedSessions(), getSavedGames(), loadCurrentSession()])
      .then(([loadedAssets, loadedDecks, loadedSessions, loadedGames, current]) => {
        setAssets(loadedAssets);
        setDeckTemplates(loadedDecks);
        setSavedSessions(loadedSessions);
        setSavedGames(loadedGames);
        if (current) dispatchBase(createAction("LOAD_SESSION", current, clientId));
      })
      .catch(() => setError("IndexedDB unavailable or failed to load saved data."));
  }, []);

  const persistAssets = (nextAssets: AssetTemplate[]) => {
    setAssets(nextAssets);
    nextAssets.forEach((asset) => saveAsset(asset).catch(() => setError("Failed to save asset.")));
  };

  const addAssets = (incoming: AssetTemplate[]) => {
    const merged = mergeById(assetsRef.current, incoming);
    persistAssets(merged);
    if (mode === "host") hostSync.current?.broadcast({ kind: "ASSET_SYNC", assets: incoming });
  };

  const persistDeckTemplate = (deck: DeckTemplate) => {
    setDeckTemplates((current) => mergeById(current, [deck]));
    saveDeckTemplate(deck).catch(() => setError("Failed to save deck template."));
    if (mode === "host") hostSync.current?.broadcast({ kind: "DECK_TEMPLATE_SYNC", deckTemplates: [deck] });
  };

  const applyAction = (action: GameAction) => {
    dispatchBase(action);
    if (mode === "host") hostSync.current?.broadcast({ kind: "ACTION", action });
    if (mode === "join") clientSync.current?.send({ kind: "ACTION", action });
  };

  React.useEffect(() => {
    const selected = findBoardObject(session, session.selectedObjectId);
    if (selected?.layerId && selected.layerId !== activeLayerId) {
      applyAction(createAction("SELECT_OBJECT", { objectId: undefined }, clientId));
    }
  }, [activeLayerId, session.selectedObjectId, session.deckInstances, session.cardInstances, session.discardPiles, session.tokenInstances, session.placedImageInstances]);

  const applyHostAction = (action: GameAction) => {
    // Validate MOVE_CARD_TO_BOARD: only the player who owns the card may place it from their hand.
    if (action.type === "MOVE_CARD_TO_BOARD") {
      const { cardId } = action.payload as { cardId: string };
      const requesterLobbyPlayer = lobbyRef.current.players.find((p) => p.clientId === action.clientId);
      if (requesterLobbyPlayer) {
        const owner = sessionRef.current.players.find((p) => p.id === requesterLobbyPlayer.playerId);
        const isInRequestersHand = Boolean(owner?.handCardInstanceIds.includes(cardId));
        const isInDiscard = sessionRef.current.discardPiles.some((pile) => pile.cardInstanceIds.includes(cardId));
        if (!isInRequestersHand && !isInDiscard) {
          // Reject: card is neither in requester's hand nor a public discard pile.
          return;
        }
      }
    }
    const resolved = action.type === "DRAW_CARD" ? resolveDrawAction(sessionRef.current, deckTemplatesRef.current, action as GameAction<{ deckInstanceId: string; playerId: string }>) : action;
    if (!resolved) {
      setError("Deck is empty or draw is invalid.");
      return;
    }
    dispatchBase(resolved);
    hostSync.current?.broadcast({ kind: "ACTION", action: resolved });
  };

  const loadSyncedState = (nextSession: GameSession, nextAssets: AssetTemplate[], nextDecks: DeckTemplate[]) => {
    addAssets(nextAssets);
    nextDecks.forEach((deck) => saveDeckTemplate(deck).catch(() => undefined));
    setDeckTemplates((current) => mergeById(current, nextDecks));
    dispatchBase(createAction("FULL_STATE_SYNC", nextSession, clientId));
  };

  const handleNetworkMessage = (message: MultiplayerMessage, peerId?: string) => {
    if (message.kind === "ACTION") {
      if (modeRef.current === "host") applyHostAction(message.action);
      else dispatchBase(message.action);
    }
    if (message.kind === "FULL_STATE_SYNC") loadSyncedState(message.session, message.assets, message.deckTemplates);
    if (message.kind === "ASSET_SYNC") addAssets(message.assets);
    if (message.kind === "DECK_TEMPLATE_SYNC") {
      setDeckTemplates((current) => mergeById(current, message.deckTemplates));
      message.deckTemplates.forEach((deck) => saveDeckTemplate(deck).catch(() => undefined));
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
    if (modeRef.current === "host" && peerId) {
      const required = getAssetsForSession(sessionRef.current, assetsRef.current, deckTemplatesRef.current);
      hostSync.current?.broadcast({ kind: "FULL_STATE_SYNC", session: sessionRef.current, assets: required, deckTemplates: deckTemplatesRef.current });
    }
  };

  const setBoardImage = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    if (asset) addAssets([{ ...asset, sharedInSession: true }]);
    applyAction(createAction("SET_BOARD_IMAGE", { assetId }, clientId));
    setModal(undefined);
  };

  const placeImage = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    if (asset) addAssets([{ ...asset, sharedInSession: true }]);
    applyAction(createAction("PLACE_IMAGE", { id: crypto.randomUUID(), assetId, x: 180, y: 150, layerId: activeLayerId }, clientId));
    setModal(undefined);
  };

  const createTokenFromAsset = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    if (asset) addAssets([{ ...asset, sharedInSession: true }]);
    applyAction(createAction("CREATE_TOKEN", { id: crypto.randomUUID(), assetId, x: 220, y: 180, layerId: activeLayerId }, clientId));
    setModal(undefined);
  };

  const addDeckInstance = (deck: DeckTemplate) => {
    const deckAssetIds = new Set([...deck.cardAssetIds, ...(deck.defaultBackAssetId ? [deck.defaultBackAssetId] : []), ...Object.values(deck.cardBackAssetIds ?? {})]);
    addAssets(assets.filter((asset) => deckAssetIds.has(asset.id)).map((asset) => ({ ...asset, sharedInSession: true })));
    applyAction(createAction("ADD_DECK_INSTANCE", { id: crypto.randomUUID(), deckTemplateId: deck.id, name: deck.name, cardAssetIds: deck.cardAssetIds, x: 120, y: 120, backAssetId: deck.defaultBackAssetId, layerId: activeLayerId }, clientId));
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

  // Layer helpers
  const getFallbackLayerId = (excludeLayerId: string): string => {
    const other = session.layers.find((l) => l.id !== excludeLayerId);
    return other?.id ?? excludeLayerId;
  };

  const createLayer = () =>
    applyAction(createAction("CREATE_LAYER", { id: crypto.randomUUID(), name: "New Layer" }, clientId));

  const deleteLayer = (layerId: string) => {
    const fallbackLayerId = getFallbackLayerId(layerId);
    applyAction(createAction("DELETE_LAYER", { layerId, fallbackLayerId }, clientId));
    if (activeLayerId === layerId) setActiveLayerId(fallbackLayerId);
  };

  const moveLayerUp = (layerId: string) => {
    const sorted = [...session.layers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((l) => l.id === layerId);
    if (idx <= 0) return;
    const reordered = [...sorted];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    applyAction(createAction("REORDER_LAYERS", { layerIds: reordered.map((l) => l.id) }, clientId));
  };

  const moveLayerDown = (layerId: string) => {
    const sorted = [...session.layers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((l) => l.id === layerId);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    applyAction(createAction("REORDER_LAYERS", { layerIds: reordered.map((l) => l.id) }, clientId));
  };

  const drawDeck = (deckInstanceId: string) => {
    const raw = createAction("DRAW_CARD", { deckInstanceId, playerId: sessionRef.current.activePlayerId }, clientId);
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

  const moveObject = (objectType: AnyBoardObject["type"], objectId: string, x: number, y: number) =>
    applyAction(createAction("MOVE_OBJECT", { objectType, objectId, x, y }, clientId));

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

  const saveSession = () => {
    saveNamedSession(session).then(() => getSavedSessions().then(setSavedSessions)).catch(() => setError("Failed to save session."));
  };

  const loadGameBundle = (bundle: SessionBundle) => {
    addAssets(bundle.assets);
    bundle.deckTemplates.forEach(persistDeckTemplate);
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

  const exportSession = () => {
    const bundle = createSessionBundle(session, assets, deckTemplates, { kind: "game", name: session.name });
    const blob = new Blob([stringifySessionBundle(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${session.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "session"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSession = async (file: File) => {
    try {
      const bundle = parseSessionBundle(await file.text());
      addAssets(bundle.assets);
      bundle.deckTemplates.forEach(persistDeckTemplate);
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
      setOfferCode(invite.offerCode);
      setOfferPeerId(invite.peerId);
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
      await hostSync.current?.acceptAnswer(offerPeerId, code);
      setNetworkStatus("connected");
      const currentLobby = lobbyRef.current;
      if (currentLobby.players.length < currentLobby.maxPlayers && !currentLobby.players.some((player) => player.clientId === offerPeerId)) {
        const newPlayer = createLobbyPlayer(offerPeerId || crypto.randomUUID(), false, currentLobby.players.length);
        const next = {
          ...currentLobby,
          players: [...currentLobby.players, newPlayer]
        };
        lobbyRef.current = next;
        setLobby(next);
        hostSync.current?.broadcast({ kind: "LOBBY_SYNC", lobby: next });
        // Inform the joining peer of their assigned playerId so they can identify themselves.
        hostSync.current?.sendToPeer(offerPeerId, { kind: "PLAYER_ASSIGN", playerId: newPlayer.playerId });
      }
      hostSync.current?.syncFullState(
        sessionRef.current,
        getAssetsForSession(sessionRef.current, assetsRef.current, deckTemplatesRef.current),
        deckTemplatesRef.current
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid answer code.");
    }
  };

  const startLobbyGame = () => {
    const players = lobby.mode === "local" ? createPlayers(lobby.maxPlayers) : lobby.players.slice(0, lobby.maxPlayers).map(lobbyPlayerToGamePlayer);
    if (lobby.mode === "host" && players.length < lobby.maxPlayers) {
      setError("Fill each selected player seat before starting the multiplayer game.");
      return;
    }
    const nextSession = { ...createEmptySession(lobby.maxPlayers, "Multiplayer Session"), players, activePlayerId: players[0]?.id ?? session.activePlayerId };
    const nextLobby = { ...lobby, status: "in-game" as const };
    setLobby(nextLobby);
    dispatchBase(createAction("LOAD_SESSION", nextSession, clientId));
    hostSync.current?.broadcast({ kind: "START_GAME", lobby: nextLobby, session: nextSession, assets: getAssetsForSession(nextSession, assets, deckTemplates), deckTemplates });
  };

  const disconnect = () => {
    hostSync.current?.close();
    clientSync.current?.close();
    setMode("local");
    setMyAssignedPlayerId("");
    setNetworkStatus("idle");
    setPeers([]);
    setOfferCode("");
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
        onAddDiscard={() => applyAction(createAction("CREATE_DISCARD_PILE", { id: crypto.randomUUID(), name: "Discard", x: 260, y: 160, layerId: activeLayerId }, clientId))}
        onAddToken={() => applyAction(createAction("CREATE_TOKEN", { id: crypto.randomUUID(), label: "1", color: "#facc15", x: 240, y: 220, layerId: activeLayerId }, clientId))}
        onPlaceImage={() => setModal("placeImage")}
        onOpenMultiplayer={() => setModal("multiplayer")}
        onSave={saveSession}
        onSaveGame={() => saveGame()}
        onLoad={() => setModal("sessions")}
        onExport={exportSession}
        onImport={() => importInputRef.current?.click()}
        onNewSession={newSession}
        layers={session.layers}
        activeLayerId={activeLayerId}
        onSetActiveLayer={setActiveLayerId}
      />
      <input ref={importInputRef} className="hidden-input" type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && importSession(event.target.files[0])} />
      {error && <div className="toast"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
      <div className="workspace">
        <aside className="left-panel">
          <LobbyPanel
            lobby={lobby}
            localClientId={clientId}
            localPlayerId={localPlayerId}
            onMaxPlayers={(maxPlayers) => setLobby((current) => ({ ...current, maxPlayers }))}
            onName={(name) => updateLocalLobbyPlayer({ name })}
            onReady={(ready) => updateLocalLobbyPlayer({ ready })}
            onOpenMultiplayer={() => setModal("multiplayer")}
            onStart={startLobbyGame}
          />
          <LayersPanel
            layers={session.layers}
            activeLayerId={activeLayerId}
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
              <button key={deck.id} className="deck-list-row" onClick={() => addDeckInstance(deck)}>
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
        <BoardCanvas session={session} assets={assets} perspectiveRotation={getPerspectiveRotation(session, boardPerspectivePlayerId)} activeLayerId={activeLayerId} onSelect={(objectId) => applyAction(createAction("SELECT_OBJECT", { objectId }, clientId))} onMove={moveObject} onDrawDeck={drawDeck} />
        <ObjectInspector
          session={session}
          assets={assets}
          deckTemplates={deckTemplates}
          onRotate={rotateObject}
          onResize={resizeObject}
          onDelete={(object) => applyAction(createAction("DELETE_OBJECT", { objectType: object.type, objectId: object.id }, clientId))}
          onDuplicate={(object) => applyAction(createAction("DUPLICATE_OBJECT", { objectType: object.type, objectId: object.id, newId: crypto.randomUUID() }, clientId))}
          onFront={(object) => applyAction(createAction("BRING_TO_FRONT", { objectType: object.type, objectId: object.id }, clientId))}
          onBack={(object) => applyAction(createAction("SEND_TO_BACK", { objectType: object.type, objectId: object.id }, clientId))}
          onFlipCard={(cardId) => applyAction(createAction("FLIP_CARD", { cardId }, clientId))}
          onMoveCardToHand={(cardId, playerId) => applyAction(createAction("MOVE_CARD_TO_HAND", { cardId, playerId }, clientId))}
          onMoveCardToBoard={(cardId, x, y) => applyAction(createAction("MOVE_CARD_TO_BOARD", { cardId, x, y }, clientId))}
          onMoveCardToDiscard={(cardId, discardPileId) => applyAction(createAction("MOVE_CARD_TO_DISCARD", { cardId, discardPileId }, clientId))}
          onDrawDeck={drawDeck}
          onShuffleDeck={shuffleDeck}
          onResetDeck={resetDeck}
          onAssignLayer={(object, layerId) => applyAction(createAction("ASSIGN_LAYER", { objectType: object.type, objectId: object.id, layerId }, clientId))}
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
        onMoveCardToBoard={(cardId) => applyAction(createAction("MOVE_CARD_TO_BOARD", { cardId, x: 340, y: 240 }, clientId))}
      />
      {(modal === "assets" || modal === "setBoard" || modal === "placeImage" || modal === "token") && (
        <AssetLibraryModal
          assets={assets}
          mode={modal === "setBoard" ? "setBoard" : modal === "placeImage" ? "placeImage" : modal === "token" ? "token" : "browse"}
          onClose={() => setModal(undefined)}
          onUpload={addAssets}
          onRename={(assetId, name) => persistAssets(assets.map((asset) => asset.id === assetId ? { ...asset, name, updatedAt: Date.now() } : asset))}
          onDelete={(assetId) => {
            const inUse = JSON.stringify(session).includes(assetId);
            const run = () => {
              setAssets((current) => current.filter((asset) => asset.id !== assetId));
              deleteAsset(assetId).catch(() => setError("Failed to delete asset."));
              setConfirm(undefined);
            };
            if (inUse) setConfirm({ title: "Asset In Use", message: "This asset is used in the current session. Delete it anyway?", onConfirm: run });
            else run();
          }}
          onCategory={(assetId, category: AssetCategory) => persistAssets(assets.map((asset) => asset.id === assetId ? { ...asset, category, updatedAt: Date.now() } : asset))}
          onUseAsBoard={setBoardImage}
          onUseAsToken={createTokenFromAsset}
          onAddToDeck={() => setModal("createDeck")}
          onPlaceOnBoard={placeImage}
          onError={setError}
        />
      )}
      {modal === "createDeck" && <DeckCreatorModal assets={assets} deckTemplates={deckTemplates} onClose={() => setModal(undefined)} onUpload={addAssets} onSave={persistDeckTemplate} onDelete={removeDeckTemplate} onError={setError} />}
      {modal === "addDeck" && <AddDeckModal deckTemplates={deckTemplates} onClose={() => setModal(undefined)} onAdd={addDeckInstance} />}
      {modal === "sessions" && (
        <SessionManagerModal
          sessions={savedSessions}
          games={savedGames}
          currentSession={session}
          onClose={() => setModal(undefined)}
          onLoad={(next) => { applyAction(createAction("LOAD_SESSION", next, clientId)); setModal(undefined); }}
          onDelete={(id) => deleteSavedSession(id).then(() => getSavedSessions().then(setSavedSessions))}
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
        offerCode={offerCode}
        answerCode={answerCode}
        onClose={() => setModal(undefined)}
        onLocal={disconnect}
        onHost={startHost}
        onJoin={joinHost}
        onAcceptAnswer={acceptAnswer}
        onDisconnect={disconnect}
        onSync={() => hostSync.current?.syncFullState(session, getAssetsForSession(session, assets, deckTemplates), deckTemplates)}
      />
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onCancel={() => setConfirm(undefined)} onConfirm={confirm.onConfirm} />}
    </div>
  );
}
