import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { CardInstance } from "../types/game";

interface CardViewProps {
  card: CardInstance;
  asset?: AssetTemplate;
  backAsset?: AssetTemplate;
  selected: boolean;
  perspectiveRotation: number;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

export function CardView({ card, asset, backAsset, selected, perspectiveRotation, onSelect, onDragEnd }: CardViewProps) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <DraggableObject
      className={`board-object card-object ${selected ? "selected" : ""} ${hovered ? "readable-hover" : ""}`}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        zIndex: hovered ? card.zIndex + 9000 : card.zIndex,
        transform: hovered ? `rotate(${-perspectiveRotation}deg) scale(1.35)` : `rotate(${card.rotation}deg)`
      }}
      movementRotation={perspectiveRotation}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
      onHoverChange={setHovered}
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
  movementRotation?: number;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onHoverChange?: (hovered: boolean) => void;
}

export function DraggableObject({ className, style, children, movementRotation = 0, onSelect, onDragEnd, onHoverChange }: DraggableObjectProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const start = React.useRef<{ pointerX: number; pointerY: number; x: number; y: number } | undefined>(undefined);

  const toBoardDelta = (screenDx: number, screenDy: number) => {
    const radians = (-movementRotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: screenDx * cos - screenDy * sin,
      y: screenDx * sin + screenDy * cos
    };
  };

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
    const delta = toBoardDelta(event.clientX - start.current.pointerX, event.clientY - start.current.pointerY);
    const x = start.current.x + delta.x;
    const y = start.current.y + delta.y;
    ref.current.style.left = `${x}px`;
    ref.current.style.top = `${y}px`;
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || !ref.current) return;
    const delta = toBoardDelta(event.clientX - start.current.pointerX, event.clientY - start.current.pointerY);
    const x = start.current.x + delta.x;
    const y = start.current.y + delta.y;
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
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
    >
      {children}
    </div>
  );
}
