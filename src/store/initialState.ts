import type { GameSession, Layer, Player } from "../types/game";
import type { LobbyPlayer, LobbyState } from "../types/lobby";

const colors = ["#f97316", "#22c55e", "#38bdf8", "#e879f9"];

export const LAYER_IDS = {
  board: "layer-board",
  default: "layer-default",
  cards: "layer-cards",
  tokens: "layer-tokens"
} as const;

export const MAIN_CANVAS_ID = "canvas-main";

export const DEFAULT_LAYERS: Layer[] = [
  { id: LAYER_IDS.board, name: "Board", visible: true, locked: false, order: 0 },
  { id: LAYER_IDS.default, name: "Default", visible: true, locked: false, order: 1 },
  { id: LAYER_IDS.cards, name: "Cards", visible: true, locked: false, order: 2 },
  { id: LAYER_IDS.tokens, name: "Tokens", visible: true, locked: false, order: 3 }
];

export const createPlayers = (count: 2 | 3 | 4): Player[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    color: colors[index],
    handCardInstanceIds: []
  }));

export const createCanvasTabs = () => [{ id: MAIN_CANVAS_ID, name: "Canvas 1" }];

export const createEmptySession = (count: 2 | 3 | 4 = 2, name = "Untitled Session"): GameSession => {
  const players = createPlayers(count);
  return {
    id: crypto.randomUUID(),
    name,
    players,
    activePlayerId: players[0].id,
    deckInstances: [],
    cardInstances: [],
    discardPiles: [],
    tokenInstances: [],
    placedImageInstances: [],
    layers: DEFAULT_LAYERS.map((layer) => ({ ...layer })),
    canvasTabs: createCanvasTabs(),
    lastUpdatedAt: Date.now()
  };
};

export const createLobbyPlayer = (clientId: string, isHost: boolean, index = 0): LobbyPlayer => ({
  clientId,
  playerId: crypto.randomUUID(),
  name: isHost ? "Host" : `Player ${index + 1}`,
  color: colors[index % colors.length],
  connected: true,
  ready: isHost,
  isHost,
  seatNumber: (index + 1) as 1 | 2 | 3 | 4
});

export const createLobby = (clientId: string, mode: "local" | "host" | "join", maxPlayers: 2 | 3 | 4): LobbyState => ({
  lobbyId: crypto.randomUUID(),
  mode,
  hostClientId: mode === "join" ? "" : clientId,
  maxPlayers,
  players: [createLobbyPlayer(clientId, mode !== "join")],
  status: "waiting",
  selectedDeckTemplateIds: []
});
