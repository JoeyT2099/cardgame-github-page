import type { DiscardPile } from "../types/game";
import { DraggableObject } from "./CardView";

interface DiscardPileViewProps {
  pile: DiscardPile;
  selected: boolean;
  perspectiveRotation: number;
  movementScale?: number;
  interactive?: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

export function DiscardPileView({ pile, selected, perspectiveRotation, movementScale = 1, interactive = true, onSelect, onDragEnd }: DiscardPileViewProps) {
  return (
    <DraggableObject
      className={`board-object discard-object ${selected ? "selected" : ""}`}
      style={{
        left: pile.x,
        top: pile.y,
        width: pile.width,
        height: pile.height,
        zIndex: pile.zIndex,
        transform: `rotate(${pile.rotation}deg)`
      }}
      movementRotation={perspectiveRotation}
      movementScale={movementScale}
      interactive={interactive}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
    >
      <div className="object-label">
        <span>{pile.name}</span>
        <strong>{pile.cardInstanceIds.length}</strong>
      </div>
    </DraggableObject>
  );
}
