import type { Layer } from "../types/game";

interface ToolbarProps {
  onOpenAssets: () => void;
  onSetBoard: () => void;
  onCreateDeck: () => void;
  onAddDeck: () => void;
  onAddDiscard: () => void;
  onAddToken: () => void;
  onPlaceImage: () => void;
  onOpenMultiplayer: () => void;
  onSaveGame: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: () => void;
  onNewSession: () => void;
  onUndo: () => void;
  layers: Layer[];
  activeLayerId: string;
  onSetActiveLayer: (layerId: string) => void;
}

export function Toolbar(props: ToolbarProps) {
  return (
    <header className="toolbar">
      <strong>Card Game Sandbox</strong>
      <button title="Open the asset library." onClick={props.onOpenAssets}>Asset Library</button>
      <button title="Choose and place a board image." onClick={props.onSetBoard}>Add Board</button>
      <button title="Create or edit saved decks." onClick={props.onCreateDeck}>Create Deck</button>
      <button title="Place a saved deck on the canvas." onClick={props.onAddDeck}>Add Deck</button>
      <button title="Create a named discard pile." onClick={props.onAddDiscard}>Add Discard Pile</button>
      <button title="Choose and place a token." onClick={props.onAddToken}>Add Token</button>
      <button title="Place an image on the active layer." onClick={props.onPlaceImage}>Place Image</button>
      <button title="Open multiplayer host and join controls." onClick={props.onOpenMultiplayer}>Multiplayer</button>
      <button title="Undo your previous table action." onClick={props.onUndo}>Undo</button>
      <button title="Save the table as a reusable game." onClick={props.onSaveGame}>Save Game</button>
      <button title="Open saved games." onClick={props.onLoad}>Load Game</button>
      <button title="Export the current game file." onClick={props.onExport}>Export Game</button>
      <button title="Import a game file." onClick={props.onImport}>Import Game</button>
      <button className="danger subtle" title="Clear the table and start a new session." onClick={props.onNewSession}>New Session</button>
      {props.layers.length > 0 && (
        <label className="toolbar-layer-label">
          Active Layer:
          <select
            value={props.activeLayerId}
            onChange={(e) => props.onSetActiveLayer(e.target.value)}
            className="toolbar-layer-select"
          >
            {[...props.layers].sort((a, b) => b.order - a.order).map((layer) => (
              <option key={layer.id} value={layer.id}>{layer.name}</option>
            ))}
          </select>
        </label>
      )}
    </header>
  );
}
