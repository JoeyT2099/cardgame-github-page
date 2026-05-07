import type { DeckInstance } from "../types/game";
import { DraggableObject } from "./CardView";

interface DeckInstanceViewProps {
  deck: DeckInstance;
  selected: boolean;
  perspectiveRotation: number;
  movementScale?: number;
  interactive?: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDraw: () => void;
}

export function DeckInstanceView({ deck, selected, perspectiveRotation, movementScale = 1, interactive = true, onSelect, onDragEnd, onDraw }: DeckInstanceViewProps) {
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
      movementRotation={perspectiveRotation}
      movementScale={movementScale}
      interactive={interactive}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
    >
      <button className="object-fill-button" title="Select this deck. Double-click to draw the top card." onDoubleClick={onDraw} onClick={onSelect}>
        <span>{deck.name}</span>
        <strong>{deck.remainingCardAssetIds.length}</strong>
      </button>
    </DraggableObject>
  );
}
