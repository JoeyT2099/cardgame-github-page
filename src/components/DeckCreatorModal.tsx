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
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [backAssetId, setBackAssetId] = React.useState("");

  const setQuantity = (assetId: string, quantity: number) => {
    setQuantities((current) => ({
      ...current,
      [assetId]: Math.max(0, Math.min(999, Math.floor(Number.isFinite(quantity) ? quantity : 0)))
    }));
  };

  const deckCardAssetIds = React.useMemo(
    () => Object.entries(quantities).flatMap(([assetId, quantity]) => Array.from({ length: quantity }, () => assetId)),
    [quantities]
  );

  const selectedUniqueCount = Object.values(quantities).filter((quantity) => quantity > 0).length;

  const uploadCards = (uploadedAssets: AssetTemplate[]) => {
    setQuantities((current) => {
      const next = { ...current };
      uploadedAssets.forEach((asset) => {
        next[asset.id] = Math.max(1, next[asset.id] ?? 1);
      });
      return next;
    });
    onUpload(uploadedAssets);
  };

  const uploadBack = (uploadedAssets: AssetTemplate[]) => {
    if (uploadedAssets[0]) setBackAssetId(uploadedAssets[0].id);
    onUpload(uploadedAssets);
  };

  const save = () => {
    if (!deckCardAssetIds.length) {
      onError("Add at least one card to the deck by setting a quantity above 0.");
      return;
    }
    const now = Date.now();
    onSave({
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled Deck",
      cardAssetIds: deckCardAssetIds,
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
          <FileUploadButton label="Upload Card Images" category="card" onAssets={uploadCards} onError={onError} />
          <FileUploadButton label="Upload Card Back" category="deck" multiple={false} onAssets={uploadBack} onError={onError} />
        </div>
        <div className="deck-count-summary">
          <strong>{deckCardAssetIds.length}</strong>
          <span>total cards</span>
          <strong>{selectedUniqueCount}</strong>
          <span>unique card images</span>
        </div>
        <div className="asset-grid compact">
          {cardAssets.map((asset) => (
            <article key={asset.id} className={`asset-pick ${quantities[asset.id] > 0 ? "picked" : ""}`}>
              <img src={asset.imageDataUrl} alt={asset.name} />
              <span>{asset.name}</span>
              <div className="quantity-control">
                <button type="button" onClick={() => setQuantity(asset.id, (quantities[asset.id] ?? 0) - 1)}>-</button>
                <label>
                  Qty
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={quantities[asset.id] ?? 0}
                    onChange={(event) => setQuantity(asset.id, Number(event.target.value))}
                  />
                </label>
                <button type="button" onClick={() => setQuantity(asset.id, (quantities[asset.id] ?? 0) + 1)}>+</button>
              </div>
            </article>
          ))}
        </div>
        <div className="modal-actions">
          <span>{deckCardAssetIds.length} total cards in deck</span>
          <button onClick={save}>Save Deck Template</button>
        </div>
      </div>
    </div>
  );
}
