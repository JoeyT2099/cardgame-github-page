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

export function BoardCanvas({ session, assets, onSelect, onMove, onDrawDeck }: BoardCanvasProps) {
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

  const noop = () => {};

  return (
    <main className="board-wrap">
      <div className="board-canvas" onPointerDown={(event) => event.currentTarget === event.target && onSelect(undefined)}>
        {boardAsset ? <img className="board-background" src={boardAsset.imageDataUrl} alt={boardAsset.name} /> : <div className="empty-board">Set a board image or start placing pieces.</div>}
        {session.placedImageInstances
          .filter((image) => !isHidden(image.layerId))
          .map((image) => (
            <PlacedImageView
              key={image.id}
              image={{ ...image, zIndex: effectiveZIndex(layers, image.layerId, image.zIndex) }}
              asset={assetMap.get(image.assetId)}
              selected={session.selectedObjectId === image.id}
              onSelect={isLocked(image.layerId) ? noop : () => onSelect(image.id)}
              onDragEnd={isLocked(image.layerId) ? noop : (x, y) => onMove("image", image.id, x, y)}
            />
          ))}
        {session.deckInstances
          .filter((deck) => !isHidden(deck.layerId))
          .map((deck) => (
            <DeckInstanceView
              key={deck.id}
              deck={{ ...deck, zIndex: effectiveZIndex(layers, deck.layerId, deck.zIndex) }}
              selected={session.selectedObjectId === deck.id}
              onSelect={isLocked(deck.layerId) ? noop : () => onSelect(deck.id)}
              onDragEnd={isLocked(deck.layerId) ? noop : (x, y) => onMove("deck", deck.id, x, y)}
              onDraw={isLocked(deck.layerId) ? noop : () => onDrawDeck(deck.id)}
            />
          ))}
        {session.discardPiles
          .filter((pile) => !isHidden(pile.layerId))
          .map((pile) => (
            <DiscardPileView
              key={pile.id}
              pile={{ ...pile, zIndex: effectiveZIndex(layers, pile.layerId, pile.zIndex) }}
              selected={session.selectedObjectId === pile.id}
              onSelect={isLocked(pile.layerId) ? noop : () => onSelect(pile.id)}
              onDragEnd={isLocked(pile.layerId) ? noop : (x, y) => onMove("discard", pile.id, x, y)}
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
              selected={session.selectedObjectId === card.id}
              onSelect={isLocked(card.layerId) ? noop : () => onSelect(card.id)}
              onDragEnd={isLocked(card.layerId) ? noop : (x, y) => onMove("card", card.id, x, y)}
            />
          ))}
        {session.tokenInstances
          .filter((token) => !isHidden(token.layerId))
          .map((token) => (
            <TokenView
              key={token.id}
              token={{ ...token, zIndex: effectiveZIndex(layers, token.layerId, token.zIndex) }}
              asset={token.assetId ? assetMap.get(token.assetId) : undefined}
              selected={session.selectedObjectId === token.id}
              onSelect={isLocked(token.layerId) ? noop : () => onSelect(token.id)}
              onDragEnd={isLocked(token.layerId) ? noop : (x, y) => onMove("token", token.id, x, y)}
            />
          ))}
      </div>
    </main>
  );
}
