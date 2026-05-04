import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { CardInstance } from "../types/game";

interface CardViewProps {
  card: CardInstance;
  asset?: AssetTemplate;
  backAsset?: AssetTemplate;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

export function CardView({ card, asset, backAsset, selected, onSelect, onDragEnd }: CardViewProps) {
  return (
    <DraggableObject
      className={`board-object card-object ${selected ? "selected" : ""}`}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        zIndex: card.zIndex,
        transform: `rotate(${card.rotation}deg)`
      }}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
    >
      {card.faceUp && asset ? (
        <img src={asset.imageDataUrl} alt={asset.name} />
      ) : backAsset ? (
        <img src={backAsset.imageDataUrl} alt={backAsset.name} />
      ) : (
        <div className="generic-card-back">Card</div>
      )}
    </DraggableObject>
  );
}

interface DraggableObjectProps {
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

export function DraggableObject({ className, style, children, onSelect, onDragEnd }: DraggableObjectProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const start = React.useRef<{ pointerX: number; pointerY: number; x: number; y: number } | undefined>(undefined);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    onSelect();
    const element = ref.current;
    if (!element) return;
    element.setPointerCapture(event.pointerId);
    start.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: Number.parseFloat(String(style.left ?? 0)),
      y: Number.parseFloat(String(style.top ?? 0))
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || !ref.current) return;
    const x = start.current.x + event.clientX - start.current.pointerX;
    const y = start.current.y + event.clientY - start.current.pointerY;
    ref.current.style.left = `${x}px`;
    ref.current.style.top = `${y}px`;
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || !ref.current) return;
    const x = start.current.x + event.clientX - start.current.pointerX;
    const y = start.current.y + event.clientY - start.current.pointerY;
    start.current = undefined;
    onDragEnd(Math.round(x), Math.round(y));
  };

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      {children}
    </div>
  );
}
