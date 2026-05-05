import type { AssetTemplate } from "../types/assets";
import type { PlacedImageInstance } from "../types/game";
import { DraggableObject } from "./CardView";

interface PlacedImageViewProps {
  image: PlacedImageInstance;
  asset?: AssetTemplate;
  selected: boolean;
  perspectiveRotation: number;
  movementScale?: number;
  interactive?: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

export function PlacedImageView({ image, asset, selected, perspectiveRotation, movementScale = 1, interactive = true, onSelect, onDragEnd }: PlacedImageViewProps) {
  return (
    <DraggableObject
      className={`board-object placed-image-object ${selected ? "selected" : ""}`}
      style={{
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        zIndex: image.zIndex,
        transform: `rotate(${image.rotation}deg)`
      }}
      movementRotation={perspectiveRotation}
      movementScale={movementScale}
      interactive={interactive}
      onSelect={onSelect}
      onDragEnd={onDragEnd}
    >
      {asset ? <img src={asset.imageDataUrl} alt={asset.name} /> : <div className="missing-asset">Missing asset</div>}
    </DraggableObject>
  );
}
