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
  onUseAsBoard: (assetId: string) => void;
  onUseAsToken: (assetId: string) => void;
  onAddToDeck: (assetId: string) => void;
  onPlaceOnBoard: (assetId: string) => void;
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

export function AssetLibraryModal(props: AssetLibraryModalProps) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<AssetFilter>("all");
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
                <button onClick={() => props.onUseAsBoard(asset.id)}>Use as Board</button>
                <button onClick={() => props.onUseAsToken(asset.id)}>Use as Token</button>
                <button onClick={() => props.onAddToDeck(asset.id)}>Add to Deck</button>
                <button onClick={() => props.onPlaceOnBoard(asset.id)}>Place</button>
                <button className="danger" onClick={() => props.onDelete(asset.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
