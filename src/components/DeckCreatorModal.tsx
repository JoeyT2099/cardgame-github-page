import React from "react";
import type { AssetTemplate, DeckTemplate } from "../types/assets";
import { FileUploadButton } from "./FileUploadButton";

interface DeckCreatorModalProps {
  assets: AssetTemplate[];
  deckTemplates: DeckTemplate[];
  onClose: () => void;
  onUpload: (assets: AssetTemplate[]) => void;
  onSave: (deck: DeckTemplate) => void;
  onDelete: (deckId: string) => boolean;
  onExport: (deckId: string) => void;
  onImport: () => void;
  onError: (message: string) => void;
}

const getQuantities = (deck?: DeckTemplate) =>
  (deck?.cardAssetIds ?? []).reduce<Record<string, number>>((counts, assetId) => {
    counts[assetId] = (counts[assetId] ?? 0) + 1;
    return counts;
  }, {});

const copyBacksForSelectedCards = (backs: Record<string, string> | undefined, quantities: Record<string, number>) => {
  const selected = new Set(Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([assetId]) => assetId));
  return Object.fromEntries(Object.entries(backs ?? {}).filter(([assetId, backAssetId]) => selected.has(assetId) && backAssetId));
};

export function DeckCreatorModal({ assets, deckTemplates, onClose, onUpload, onSave, onDelete, onExport, onImport, onError }: DeckCreatorModalProps) {
  const sortedDecks = React.useMemo(() => [...deckTemplates].sort((a, b) => a.name.localeCompare(b.name)), [deckTemplates]);
  const [editingDeckId, setEditingDeckId] = React.useState<string>("new");
  const editingDeck = editingDeckId === "new" ? undefined : deckTemplates.find((deck) => deck.id === editingDeckId);
  const cardCandidates = assets.filter((asset) => asset.category === "card" || asset.category === "deck" || asset.category === "misc");
  const backCandidates = assets.filter((asset) => asset.category === "deck" || asset.category === "card" || asset.category === "misc");

  const [name, setName] = React.useState("New Deck");
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [defaultBackAssetId, setDefaultBackAssetId] = React.useState("");
  const [cardBackAssetIds, setCardBackAssetIds] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (editingDeckId !== "new" && !editingDeck) return;
    if (!editingDeck) {
      setName("New Deck");
      setQuantities({});
      setDefaultBackAssetId("");
      setCardBackAssetIds({});
      return;
    }
    const nextQuantities = getQuantities(editingDeck);
    setName(editingDeck.name);
    setQuantities(nextQuantities);
    setDefaultBackAssetId(editingDeck.defaultBackAssetId ?? "");
    setCardBackAssetIds(copyBacksForSelectedCards(editingDeck.cardBackAssetIds, nextQuantities));
  }, [editingDeckId, editingDeck?.id]);

  const setQuantity = (assetId: string, quantity: number) => {
    setQuantities((current) => {
      const next = {
        ...current,
        [assetId]: Math.max(0, Math.min(999, Math.floor(Number.isFinite(quantity) ? quantity : 0)))
      };
      if (next[assetId] === 0) {
        delete next[assetId];
        setCardBackAssetIds((backs) => {
          const nextBacks = { ...backs };
          delete nextBacks[assetId];
          return nextBacks;
        });
      }
      return next;
    });
  };

  const deckCardAssetIds = React.useMemo(
    () => Object.entries(quantities).flatMap(([assetId, quantity]) => Array.from({ length: quantity }, () => assetId)),
    [quantities]
  );

  const selectedAssetIds = React.useMemo(() => new Set(Object.keys(quantities)), [quantities]);
  const visibleCardAssets = editingDeck ? cardCandidates.filter((asset) => selectedAssetIds.has(asset.id)) : cardCandidates;
  const selectedUniqueCount = selectedAssetIds.size;

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
    if (uploadedAssets[0]) setDefaultBackAssetId(uploadedAssets[0].id);
    onUpload(uploadedAssets);
  };

  const setCardBack = (assetId: string, backAssetId: string) => {
    setCardBackAssetIds((current) => {
      const next = { ...current };
      if (backAssetId) next[assetId] = backAssetId;
      else delete next[assetId];
      return next;
    });
  };

  const setAllCardBacks = () => {
    if (!defaultBackAssetId) {
      setCardBackAssetIds({});
      return;
    }
    setCardBackAssetIds(Object.fromEntries(Object.keys(quantities).map((assetId) => [assetId, defaultBackAssetId])));
  };

  const save = () => {
    if (!deckCardAssetIds.length) {
      onError("Add at least one card to the deck by setting a quantity above 0.");
      return;
    }
    const now = Date.now();
    const deck: DeckTemplate = {
      id: editingDeck?.id ?? crypto.randomUUID(),
      name: name.trim() || "Untitled Deck",
      cardAssetIds: deckCardAssetIds,
      defaultBackAssetId: defaultBackAssetId || undefined,
      cardBackAssetIds: copyBacksForSelectedCards(cardBackAssetIds, quantities),
      createdAt: editingDeck?.createdAt ?? now,
      updatedAt: now
    };
    onSave(deck);
    setEditingDeckId(deck.id);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal wide-modal">
        <div className="modal-header">
          <h2>Decks</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="deck-editor-layout">
          <aside className="deck-template-list">
            <button className={editingDeckId === "new" ? "active" : ""} onClick={() => setEditingDeckId("new")}>New Deck</button>
            <button type="button" className="deck-list-action" aria-label="Import Deck" onClick={onImport}>↑ Import Deck</button>
            {sortedDecks.length > 0 && <hr className="deck-list-divider" />}
            {sortedDecks.map((deck) => (
              <button key={deck.id} className={editingDeckId === deck.id ? "active" : ""} onClick={() => setEditingDeckId(deck.id)}>
                <span>{deck.name}</span>
                <small>{deck.cardAssetIds.length} cards</small>
              </button>
            ))}
          </aside>
          <section className="deck-editor-main">
            <div className="form-row">
              <label>
                Deck Name
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                Default Card Back
                <select value={defaultBackAssetId} onChange={(event) => setDefaultBackAssetId(event.target.value)}>
                  <option value="">Generic card back</option>
                  {backCandidates.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={setAllCardBacks}>Set All Card Backs</button>
              <FileUploadButton label="Upload Card Images" category="card" onAssets={uploadCards} onError={onError} />
              <FileUploadButton label="Upload Card Back" category="deck" multiple={false} onAssets={uploadBack} onError={onError} />
            </div>
            <div className="deck-count-summary">
              <strong>{deckCardAssetIds.length}</strong>
              <span>total cards</span>
              <strong>{selectedUniqueCount}</strong>
              <span>unique card images</span>
            </div>
            {editingDeck && visibleCardAssets.length === 0 && <p className="muted">This deck has no card assets saved.</p>}
            <div className="asset-grid compact deck-card-grid">
              {visibleCardAssets.map((asset) => (
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
                  <label className="card-back-select">
                    Back
                    <select value={cardBackAssetIds[asset.id] ?? ""} onChange={(event) => setCardBack(asset.id, event.target.value)}>
                      <option value="">Use default</option>
                      {backCandidates.map((backAsset) => <option key={backAsset.id} value={backAsset.id}>{backAsset.name}</option>)}
                    </select>
                  </label>
                </article>
              ))}
            </div>
            <div className="modal-actions">
              <span>{editingDeck ? "Editing saved deck" : "Creating new deck"}</span>
              {editingDeck && <button className="danger" onClick={() => { if (onDelete(editingDeck.id)) setEditingDeckId("new"); }}>Delete Deck</button>}
              {editingDeck && <button type="button" onClick={() => onExport(editingDeck.id)}>Export Deck</button>}
              <button onClick={save}>{editingDeck ? "Save Changes" : "Save Deck"}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
