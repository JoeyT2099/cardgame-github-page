import React from "react";
import type { AssetCategory, AssetFilter, AssetTemplate } from "../types/assets";
import { FileUploadButton } from "./FileUploadButton";

interface AssetLibraryModalProps {
  assets: AssetTemplate[];
  mode: "browse" | "setBoard" | "addToDeck" | "placeImage" | "token";
  onClose: () => void;
  onUpload: (assets: AssetTemplate[]) => void;
  onRename: (assetId: string, name: string) => void;
  onDelete: (assetId: string) => void;
  onCategory: (assetId: string, category: AssetCategory) => void;
  onUseAsBoard: (assetId: string, width: number, height: number) => void;
  onUseAsToken: (assetId: string, width: number, height: number) => void;
  onCreateGenericToken: (width: number, height: number) => void;
  onAddToDeck: (assetId: string) => void;
  onPlaceOnBoard: (assetId: string, width: number, height: number) => void;
  onError: (message: string) => void;
}

const categories: { label: string; value: AssetFilter }[] = [
  { label: "All", value: "all" },
  { label: "Cards", value: "card" },
  { label: "Boards", value: "board" },
  { label: "Tokens", value: "token" },
  { label: "Decks", value: "deck" },
  { label: "Misc", value: "misc" }
];

const getDefaultSize = (mode: AssetLibraryModalProps["mode"]) => {
  if (mode === "setBoard") return { width: 720, height: 420 };
  if (mode === "token") return { width: 64, height: 64 };
  return { width: 180, height: 140 };
};

export function AssetLibraryModal(props: AssetLibraryModalProps) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<AssetFilter>("all");
  const [size, setSize] = React.useState(() => getDefaultSize(props.mode));
  const filtered = props.assets.filter((asset) => {
    const matchesQuery = asset.name.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || asset.category === filter;
    return matchesQuery && matchesFilter;
  });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.onClose]);

  React.useEffect(() => {
    setSize(getDefaultSize(props.mode));
    if (props.mode === "setBoard") setFilter("board");
    if (props.mode === "token") setFilter("token");
  }, [props.mode]);

  const setDimension = (dimension: "width" | "height", value: number) => {
    setSize((current) => ({
      ...current,
      [dimension]: Math.max(24, Math.min(2000, Math.floor(Number.isFinite(value) ? value : current[dimension])))
    }));
  };

  const isPlacementMode = props.mode === "setBoard" || props.mode === "placeImage" || props.mode === "token";
  const boardSize = props.mode === "setBoard" ? size : getDefaultSize("setBoard");
  const tokenSize = props.mode === "token" ? size : getDefaultSize("token");
  const imageSize = props.mode === "placeImage" ? size : getDefaultSize("placeImage");

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal wide-modal">
        <div className="modal-header">
          <h2>Asset Library</h2>
          <button onClick={props.onClose}>Close</button>
        </div>
        <div className="library-tools">
          <FileUploadButton label="Upload Images" category={props.mode === "setBoard" ? "board" : props.mode === "token" ? "token" : "card"} onAssets={props.onUpload} onError={props.onError} />
          <input placeholder="Search assets" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={filter} onChange={(event) => setFilter(event.target.value as AssetFilter)}>
            {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          {isPlacementMode && (
            <div className="placement-size-controls">
              <label>
                W
                <input type="number" min="24" max="2000" value={size.width} onChange={(event) => setDimension("width", Number(event.target.value))} />
              </label>
              <label>
                H
                <input type="number" min="24" max="2000" value={size.height} onChange={(event) => setDimension("height", Number(event.target.value))} />
              </label>
              {props.mode === "token" && <button type="button" onClick={() => props.onCreateGenericToken(size.width, size.height)}>Generic Token</button>}
            </div>
          )}
        </div>
        <div className="asset-grid">
          {filtered.map((asset) => (
            <article className="asset-card" key={asset.id}>
              <img src={asset.imageDataUrl} alt={asset.name} />
              <input value={asset.name} onChange={(event) => props.onRename(asset.id, event.target.value)} />
              <select value={asset.category} onChange={(event) => props.onCategory(asset.id, event.target.value as AssetCategory)}>
                <option value="card">Card</option>
                <option value="board">Board</option>
                <option value="token">Token</option>
                <option value="deck">Deck</option>
                <option value="misc">Misc</option>
              </select>
              <div className="asset-actions">
                {(props.mode === "browse" || props.mode === "setBoard") && <button onClick={() => props.onUseAsBoard(asset.id, boardSize.width, boardSize.height)}>Use as Board</button>}
                {(props.mode === "browse" || props.mode === "token") && <button onClick={() => props.onUseAsToken(asset.id, tokenSize.width, tokenSize.height)}>Use as Token</button>}
                {(props.mode === "browse" || props.mode === "addToDeck") && <button onClick={() => props.onAddToDeck(asset.id)}>Add to Deck</button>}
                {(props.mode === "browse" || props.mode === "placeImage") && <button onClick={() => props.onPlaceOnBoard(asset.id, imageSize.width, imageSize.height)}>Place</button>}
                <button className="danger" onClick={() => props.onDelete(asset.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
