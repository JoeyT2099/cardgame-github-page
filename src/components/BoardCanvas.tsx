import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { GameSession } from "../types/game";
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

export function BoardCanvas({ session, assets, onSelect, onMove, onDrawDeck }: BoardCanvasProps) {
  const assetMap = React.useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const boardAsset = session.boardAssetId ? assetMap.get(session.boardAssetId) : undefined;

  return (
    <main className="board-wrap">
      <div className="board-canvas" onPointerDown={(event) => event.currentTarget === event.target && onSelect(undefined)}>
        {boardAsset ? <img className="board-background" src={boardAsset.imageDataUrl} alt={boardAsset.name} /> : <div className="empty-board">Set a board image or start placing pieces.</div>}
        {session.placedImageInstances.map((image) => (
          <PlacedImageView
            key={image.id}
            image={image}
            asset={assetMap.get(image.assetId)}
            selected={session.selectedObjectId === image.id}
            onSelect={() => onSelect(image.id)}
            onDragEnd={(x, y) => onMove("image", image.id, x, y)}
          />
        ))}
        {session.deckInstances.map((deck) => (
          <DeckInstanceView
            key={deck.id}
            deck={deck}
            selected={session.selectedObjectId === deck.id}
            onSelect={() => onSelect(deck.id)}
            onDragEnd={(x, y) => onMove("deck", deck.id, x, y)}
            onDraw={() => onDrawDeck(deck.id)}
          />
        ))}
        {session.discardPiles.map((pile) => (
          <DiscardPileView
            key={pile.id}
            pile={pile}
            selected={session.selectedObjectId === pile.id}
            onSelect={() => onSelect(pile.id)}
            onDragEnd={(x, y) => onMove("discard", pile.id, x, y)}
          />
        ))}
        {session.cardInstances
          .filter((card) => card.location === "board")
          .map((card) => (
            <CardView
              key={card.id}
              card={card}
              asset={assetMap.get(card.assetId)}
              backAsset={card.backAssetId ? assetMap.get(card.backAssetId) : undefined}
              selected={session.selectedObjectId === card.id}
              onSelect={() => onSelect(card.id)}
              onDragEnd={(x, y) => onMove("card", card.id, x, y)}
            />
          ))}
        {session.tokenInstances.map((token) => (
          <TokenView
            key={token.id}
            token={token}
            asset={token.assetId ? assetMap.get(token.assetId) : undefined}
            selected={session.selectedObjectId === token.id}
            onSelect={() => onSelect(token.id)}
            onDragEnd={(x, y) => onMove("token", token.id, x, y)}
          />
        ))}
      </div>
    </main>
  );
}
