import React from "react";
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
import { createEmptySession, createLobby, LAYER_IDS } from "./store/initialState";
import type { AssetCategory, AssetTemplate, DeckTemplate } from "./types/assets";
import type { AnyBoardObject, GameSession } from "./types/game";
import type { AppMode, LobbyState } from "./types/lobby";
import { lobbyPlayerToGamePlayer } from "./types/lobby";
import type { MultiplayerMessage, NetworkStatus, PeerConnectionStatus } from "./types/multiplayer";
import { getAssetsForSession } from "./multiplayer/assetSync";
import { ClientSync } from "./multiplayer/clientSync";
import { HostSync } from "./multiplayer/hostSync";
import { getAssets, saveAsset, deleteAsset } from "./storage/assetStorage";
import { getDeckTemplates, saveDeckTemplate } from "./storage/deckStorage";
import { createSessionBundle, mergeById, parseSessionBundle, stringifySessionBundle } from "./storage/importExport";
import { getSavedSessions, loadCurrentSession, saveCurrentSession, saveNamedSession, deleteSavedSession, type SavedSessionRecord } from "./storage/sessionStorage";

type ModalName = "assets" | "setBoard" | "createDeck" | "addDeck" | "placeImage" | "token" | "sessions" | "multiplayer" | undefined;

const clientId = crypto.randomUUID();

export default function App() {
  const [assets, setAssets] = React.useState<AssetTemplate[]>([]);
  const [deckTemplates, setDeckTemplates] = React.useState<DeckTemplate[]>([]);
  const [savedSessions, setSavedSessions] = React.useState<SavedSessionRecord[]>([]);
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
  const hostSync = React.useRef<HostSync | null>(null);
  const clientSync = React.useRef<ClientSync | null>(null);
  const modeRef = React.useRef<AppMode>("local");
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [activeLayerId, setActiveLayerId] = React.useState<string>(LAYER_IDS.cards);

  // Keep activeLayerId valid when layers change (e.g. after loading a session)
  React.useEffect(() => {
    if (session.layers.length > 0 && !session.layers.find((l) => l.id === activeLayerId)) {
      setActiveLayerId(session.layers[session.layers.length - 1].id);
    }
  }, [session.layers, activeLayerId]);

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

  React.useEffect(() => {
    Promise.all([getAssets(), getDeckTemplates(), getSavedSessions(), loadCurrentSession()])
      .then(([loadedAssets, loadedDecks, loadedSessions, current]) => {
        setAssets(loadedAssets);
        setDeckTemplates(loadedDecks);
        setSavedSessions(loadedSessions);
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

  const applyHostAction = (action: GameAction) => {
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
    if (message.kind === "LOBBY_SYNC") setLobby(message.lobby);
    if (message.kind === "START_GAME") {
      setLobby(message.lobby);
      setMode("join");
      loadSyncedState(message.session, message.assets, message.deckTemplates);
    }
    if (message.kind === "ERROR") setError(message.message);
    if (modeRef.current === "host" && peerId) {
      const required = getAssetsForSession(sessionRef.current, assetsRef.current, deckTemplatesRef.current);
      hostSync.current?.broadcast({ kind: "FULL_STATE_SYNC", session: sessionRef.current, assets: required, deckTemplates: deckTemplatesRef.current });
    }
  };

  const selectedDeckTemplate = deckTemplates[0];

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

  const addDeckInstance = (deck = selectedDeckTemplate) => {
    if (!deck) {
      setError("Create a deck template before adding a deck to the board.");
      return;
    }
    addAssets(assets.filter((asset) => deck.cardAssetIds.includes(asset.id) || asset.id === deck.defaultBackAssetId).map((asset) => ({ ...asset, sharedInSession: true })));
    applyAction(createAction("ADD_DECK_INSTANCE", { id: crypto.randomUUID(), deckTemplateId: deck.id, name: deck.name, cardAssetIds: deck.cardAssetIds, x: 120, y: 120, backAssetId: deck.defaultBackAssetId, layerId: activeLayerId }, clientId));
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

  const exportSession = () => {
    const bundle = createSessionBundle(session, assets, deckTemplates);
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
      hostSync.current?.syncFullState(session, getAssetsForSession(session, assets, deckTemplates), deckTemplates);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid answer code.");
    }
  };

  const startLobbyGame = () => {
    const players = lobby.players.map(lobbyPlayerToGamePlayer);
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
        onAddDeck={() => addDeckInstance()}
        onAddDiscard={() => applyAction(createAction("CREATE_DISCARD_PILE", { id: crypto.randomUUID(), name: "Discard", x: 260, y: 160, layerId: activeLayerId }, clientId))}
        onAddToken={() => applyAction(createAction("CREATE_TOKEN", { id: crypto.randomUUID(), label: "1", color: "#facc15", x: 240, y: 220, layerId: activeLayerId }, clientId))}
        onPlaceImage={() => setModal("placeImage")}
        onOpenMultiplayer={() => setModal("multiplayer")}
        onSave={saveSession}
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
            onMaxPlayers={(maxPlayers) => setLobby((current) => ({ ...current, maxPlayers }))}
            onName={(name) => setLobby((current) => ({ ...current, players: current.players.map((player, index) => index === 0 ? { ...player, name } : player) }))}
            onReady={(ready) => setLobby((current) => ({ ...current, players: current.players.map((player, index) => index === 0 ? { ...player, ready } : player) }))}
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
        <BoardCanvas session={session} assets={assets} onSelect={(objectId) => applyAction(createAction("SELECT_OBJECT", { objectId }, clientId))} onMove={moveObject} onDrawDeck={drawDeck} />
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
          onMoveCardToDiscard={(cardId, discardPileId) => applyAction(createAction("MOVE_CARD_TO_DISCARD", { cardId, discardPileId }, clientId))}
          onDrawDeck={drawDeck}
          onShuffleDeck={shuffleDeck}
          onResetDeck={resetDeck}
          onAssignLayer={(object, layerId) => applyAction(createAction("ASSIGN_LAYER", { objectType: object.type, objectId: object.id, layerId }, clientId))}
        />
      </div>
      <PlayerHands session={session} assets={assets} onSetActivePlayer={(playerId) => applyAction(createAction("SET_ACTIVE_PLAYER", { playerId }, clientId))} onMoveCardToBoard={(cardId) => applyAction(createAction("MOVE_CARD_TO_BOARD", { cardId, x: 340, y: 240 }, clientId))} />
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
      {modal === "createDeck" && <DeckCreatorModal assets={assets} onClose={() => setModal(undefined)} onUpload={addAssets} onSave={persistDeckTemplate} onError={setError} />}
      {modal === "sessions" && <SessionManagerModal sessions={savedSessions} currentSession={session} onClose={() => setModal(undefined)} onLoad={(next) => { applyAction(createAction("LOAD_SESSION", next, clientId)); setModal(undefined); }} onDelete={(id) => deleteSavedSession(id).then(() => getSavedSessions().then(setSavedSessions))} />}
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
