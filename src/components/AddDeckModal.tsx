import React from "react";
import type { DeckTemplate } from "../types/assets";

interface AddDeckModalProps {
  deckTemplates: DeckTemplate[];
  onClose: () => void;
  onAdd: (deck: DeckTemplate) => void;
}

export function AddDeckModal({ deckTemplates, onClose, onAdd }: AddDeckModalProps) {
  const sortedDecks = React.useMemo(() => [...deckTemplates].sort((a, b) => a.name.localeCompare(b.name)), [deckTemplates]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h2>Add Deck</h2>
          <button title="Close this dialog." onClick={onClose}>Close</button>
        </div>
        {sortedDecks.length === 0 ? (
          <p className="muted">No saved decks yet. Create a deck first.</p>
        ) : (
          <div className="add-deck-list">
            {sortedDecks.map((deck) => (
              <button key={deck.id} className="add-deck-row" title={`Place shuffled ${deck.name} on the canvas.`} onClick={() => onAdd(deck)}>
                <span>{deck.name}</span>
                <small>{deck.cardAssetIds.length} cards</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
