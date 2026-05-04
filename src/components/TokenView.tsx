import type { AssetTemplate } from "../types/assets";
import type { TokenInstance } from "../types/game";
import { DraggableObject } from "./CardView";

interface TokenViewProps {
  token: TokenInstance;
  asset?: AssetTemplate;
  selected: boolean;
  perspectiveRotation: number;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

export function TokenView({ token, asset, selected, perspectiveRotation, onSelect, onDragEnd }: TokenViewProps) {
  return (
    <DraggableObject
      className={`board-object token-object ${selected ? "selected" : ""}`}
      style={{
        left: token.x,
        top: token.y,
        width: token.width,
        height: token.height,
        zIndex: token.zIndex,
        transform: `rotate(${token.rotation}deg)`,
        background: asset ? undefined : token.color ?? "#facc15"
      }}
      movementRotation={perspectiveRotation}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
    >
      {asset ? <img src={asset.imageDataUrl} alt={asset.name} /> : <span>{token.label ?? "1"}</span>}
    </DraggableObject>
  );
}
