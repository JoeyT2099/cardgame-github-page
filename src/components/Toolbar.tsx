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
  onSave: () => void;
  onSaveGame: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: () => void;
  onNewSession: () => void;
  layers: Layer[];
  activeLayerId: string;
  onSetActiveLayer: (layerId: string) => void;
}

export function Toolbar(props: ToolbarProps) {
  return (
    <header className="toolbar">
      <strong>Board Game Sandbox</strong>
      <button onClick={props.onOpenAssets}>Asset Library</button>
      <button onClick={props.onSetBoard}>Add Board</button>
      <button onClick={props.onCreateDeck}>Create Deck</button>
      <button onClick={props.onAddDeck}>Add Deck</button>
      <button onClick={props.onAddDiscard}>Add Discard Pile</button>
      <button onClick={props.onAddToken}>Add Token</button>
      <button onClick={props.onPlaceImage}>Place Image</button>
      <button onClick={props.onOpenMultiplayer}>Multiplayer</button>
      <button onClick={props.onSave}>Save Session</button>
      <button onClick={props.onSaveGame}>Save Game</button>
      <button onClick={props.onLoad}>Load Session</button>
      <button onClick={props.onExport}>Export</button>
      <button onClick={props.onImport}>Import</button>
      <button className="danger subtle" onClick={props.onNewSession}>New Session</button>
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
