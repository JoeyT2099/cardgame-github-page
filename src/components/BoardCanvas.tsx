import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { GameSession, Layer } from "../types/game";
import { CardView } from "./CardView";
import { DeckInstanceView } from "./DeckInstanceView";
import { DiscardPileView } from "./DiscardPileView";
import { PlacedImageView } from "./PlacedImageView";
import { TokenView } from "./TokenView";

interface BoardCanvasProps {
  session: GameSession;
  assets: AssetTemplate[];
  perspectiveRotation: number;
  activeLayerId: string;
  onSelect: (objectId?: string) => void;
  onMove: (objectType: "deck" | "card" | "discard" | "token" | "image", objectId: string, x: number, y: number) => void;
  onDrawDeck: (deckInstanceId: string) => void;
}

const getLayer = (layers: Layer[], layerId?: string): Layer | undefined =>
  layerId ? layers.find((l) => l.id === layerId) : undefined;

const effectiveZIndex = (layers: Layer[], layerId?: string, zIndex = 0): number => {
  const layer = getLayer(layers, layerId);
  return (layer?.order ?? 0) * 1000 + zIndex;
};

export function BoardCanvas({ session, assets, perspectiveRotation, activeLayerId, onSelect, onMove, onDrawDeck }: BoardCanvasProps) {
  const assetMap = React.useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const boardAsset = session.boardAssetId ? assetMap.get(session.boardAssetId) : undefined;
  const { layers } = session;

  const isHidden = (layerId?: string) => {
    const layer = getLayer(layers, layerId);
    return layer !== undefined && !layer.visible;
  };

  const isLocked = (layerId?: string) => {
    const layer = getLayer(layers, layerId);
    return layer !== undefined && layer.locked;
  };

  const canInteract = (layerId?: string) => !isLocked(layerId) && (!layerId || layerId === activeLayerId);
  const noop = () => {};

  return (
    <main className="board-wrap">
      <div className="board-canvas" onPointerDown={(event) => event.currentTarget === event.target && onSelect(undefined)}>
        <div className="board-stage" style={{ transform: `rotate(${perspectiveRotation}deg)` }} onPointerDown={(event) => event.currentTarget === event.target && onSelect(undefined)}>
        {boardAsset ? <img className="board-background" src={boardAsset.imageDataUrl} alt={boardAsset.name} /> : <div className="empty-board">Set a board image or start placing pieces.</div>}
        {session.placedImageInstances
          .filter((image) => !isHidden(image.layerId))
          .map((image) => (
            <PlacedImageView
              key={image.id}
              image={{ ...image, zIndex: effectiveZIndex(layers, image.layerId, image.zIndex) }}
              asset={assetMap.get(image.assetId)}
              selected={session.selectedObjectId === image.id && canInteract(image.layerId)}
              perspectiveRotation={perspectiveRotation}
              interactive={canInteract(image.layerId)}
              onSelect={canInteract(image.layerId) ? () => onSelect(image.id) : noop}
              onDragEnd={canInteract(image.layerId) ? (x, y) => onMove("image", image.id, x, y) : noop}
            />
          ))}
        {session.deckInstances
          .filter((deck) => !isHidden(deck.layerId))
          .map((deck) => (
            <DeckInstanceView
              key={deck.id}
              deck={{ ...deck, zIndex: effectiveZIndex(layers, deck.layerId, deck.zIndex) }}
              selected={session.selectedObjectId === deck.id && canInteract(deck.layerId)}
              perspectiveRotation={perspectiveRotation}
              interactive={canInteract(deck.layerId)}
              onSelect={canInteract(deck.layerId) ? () => onSelect(deck.id) : noop}
              onDragEnd={canInteract(deck.layerId) ? (x, y) => onMove("deck", deck.id, x, y) : noop}
              onDraw={canInteract(deck.layerId) ? () => onDrawDeck(deck.id) : noop}
            />
          ))}
        {session.discardPiles
          .filter((pile) => !isHidden(pile.layerId))
          .map((pile) => (
            <DiscardPileView
              key={pile.id}
              pile={{ ...pile, zIndex: effectiveZIndex(layers, pile.layerId, pile.zIndex) }}
              selected={session.selectedObjectId === pile.id && canInteract(pile.layerId)}
              perspectiveRotation={perspectiveRotation}
              interactive={canInteract(pile.layerId)}
              onSelect={canInteract(pile.layerId) ? () => onSelect(pile.id) : noop}
              onDragEnd={canInteract(pile.layerId) ? (x, y) => onMove("discard", pile.id, x, y) : noop}
            />
          ))}
        {session.cardInstances
          .filter((card) => card.location === "board" && !isHidden(card.layerId))
          .map((card) => (
            <CardView
              key={card.id}
              card={{ ...card, zIndex: effectiveZIndex(layers, card.layerId, card.zIndex) }}
              asset={assetMap.get(card.assetId)}
              backAsset={card.backAssetId ? assetMap.get(card.backAssetId) : undefined}
              selected={session.selectedObjectId === card.id && canInteract(card.layerId)}
              perspectiveRotation={perspectiveRotation}
              interactive={canInteract(card.layerId)}
              onSelect={canInteract(card.layerId) ? () => onSelect(card.id) : noop}
              onDragEnd={canInteract(card.layerId) ? (x, y) => onMove("card", card.id, x, y) : noop}
            />
          ))}
        {session.tokenInstances
          .filter((token) => !isHidden(token.layerId))
          .map((token) => (
            <TokenView
              key={token.id}
              token={{ ...token, zIndex: effectiveZIndex(layers, token.layerId, token.zIndex) }}
              asset={token.assetId ? assetMap.get(token.assetId) : undefined}
              selected={session.selectedObjectId === token.id && canInteract(token.layerId)}
              perspectiveRotation={perspectiveRotation}
              interactive={canInteract(token.layerId)}
              onSelect={canInteract(token.layerId) ? () => onSelect(token.id) : noop}
              onDragEnd={canInteract(token.layerId) ? (x, y) => onMove("token", token.id, x, y) : noop}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
