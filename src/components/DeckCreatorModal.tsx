import React from "react";
import type { AssetTemplate, DeckTemplate } from "../types/assets";
import { FileUploadButton } from "./FileUploadButton";

interface DeckCreatorModalProps {
  assets: AssetTemplate[];
  onClose: () => void;
  onUpload: (assets: AssetTemplate[]) => void;
  onSave: (deck: DeckTemplate) => void;
  onError: (message: string) => void;
}

export function DeckCreatorModal({ assets, onClose, onUpload, onSave, onError }: DeckCreatorModalProps) {
  const cardAssets = assets.filter((asset) => asset.category === "card" || asset.category === "deck" || asset.category === "misc");
  const [name, setName] = React.useState("New Deck");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [backAssetId, setBackAssetId] = React.useState("");

  const toggle = (assetId: string) => {
    setSelected((current) => (current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]));
  };

  const save = () => {
    if (!selected.length) {
      onError("Choose at least one card image for the deck.");
      return;
    }
    const now = Date.now();
    onSave({
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled Deck",
      cardAssetIds: selected,
      defaultBackAssetId: backAssetId || undefined,
      createdAt: now,
      updatedAt: now
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal wide-modal">
        <div className="modal-header">
          <h2>Create Deck</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="form-row">
          <label>
            Deck Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Card Back
            <select value={backAssetId} onChange={(event) => setBackAssetId(event.target.value)}>
              <option value="">Generic card back</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          <FileUploadButton label="Upload Card Images" category="card" onAssets={onUpload} onError={onError} />
        </div>
        <div className="asset-grid compact">
          {cardAssets.map((asset) => (
            <button key={asset.id} className={`asset-pick ${selected.includes(asset.id) ? "picked" : ""}`} onClick={() => toggle(asset.id)}>
              <img src={asset.imageDataUrl} alt={asset.name} />
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <span>{selected.length} cards selected</span>
          <button onClick={save}>Save Deck Template</button>
        </div>
      </div>
    </div>
  );
}
