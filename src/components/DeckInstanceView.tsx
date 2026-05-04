import type { DeckInstance } from "../types/game";
import { DraggableObject } from "./CardView";

interface DeckInstanceViewProps {
  deck: DeckInstance;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDraw: () => void;
}

export function DeckInstanceView({ deck, selected, onSelect, onDragEnd, onDraw }: DeckInstanceViewProps) {
  return (
    <DraggableObject
      className={`board-object deck-object ${selected ? "selected" : ""}`}
      style={{
        left: deck.x,
        top: deck.y,
        width: deck.width,
        height: deck.height,
        zIndex: deck.zIndex,
        transform: `rotate(${deck.rotation}deg)`
      }}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
    >
      <button className="object-fill-button" onDoubleClick={onDraw} onClick={onSelect}>
        <span>{deck.name}</span>
        <strong>{deck.remainingCardAssetIds.length}</strong>
      </button>
    </DraggableObject>
  );
}
