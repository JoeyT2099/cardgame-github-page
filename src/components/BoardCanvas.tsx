import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { CanvasTab, GameSession, Layer } from "../types/game";
import { CardView } from "./CardView";
import { DeckInstanceView } from "./DeckInstanceView";
import { DiscardPileView } from "./DiscardPileView";
import { PlacedImageView } from "./PlacedImageView";
import { TokenView } from "./TokenView";

interface BoardCanvasProps {
  session: GameSession;
  assets: AssetTemplate[];
  canvasRotation: number;
  zoom: number;
  canvasTabs: CanvasTab[];
  activeCanvasId: string;
  activeLayerId: string;
  onZoom: (zoom: number) => void;
  onCanvasRotation: (rotation: number) => void;
  onViewCenterChange: (point: { x: number; y: number }) => void;
  onCanvas: (canvasId: string) => void;
  onCreateCanvas: () => void;
  onDeleteCanvas: (canvasId: string) => void;
  onRenameCanvas: (canvasId: string, name: string) => void;
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

const normalizeRotation = (rotation: number) => (Number.isFinite(rotation) ? rotation : 0);

export function BoardCanvas({ session, assets, canvasRotation, zoom, canvasTabs, activeCanvasId, activeLayerId, onZoom, onCanvasRotation, onViewCenterChange, onCanvas, onCreateCanvas, onDeleteCanvas, onRenameCanvas, onSelect, onMove, onDrawDeck }: BoardCanvasProps) {
  const assetMap = React.useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const boardAsset = session.boardAssetId ? assetMap.get(session.boardAssetId) : undefined;
  const { layers } = session;
  const isOnActiveCanvas = (canvasId?: string) => !canvasId || canvasId === activeCanvasId;
  const hasBoardContent =
    Boolean(boardAsset) ||
    session.placedImageInstances.some((image) => isOnActiveCanvas(image.canvasId)) ||
    session.deckInstances.some((deck) => isOnActiveCanvas(deck.canvasId)) ||
    session.cardInstances.some((card) => card.location === "board" && isOnActiveCanvas(card.canvasId)) ||
    session.tokenInstances.some((token) => isOnActiveCanvas(token.canvasId)) ||
    session.discardPiles.some((pile) => isOnActiveCanvas(pile.canvasId));
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [editingCanvasId, setEditingCanvasId] = React.useState<string>();
  const [editingCanvasName, setEditingCanvasName] = React.useState("");
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const panStart = React.useRef<{ pointerX: number; pointerY: number; x: number; y: number; moved: boolean } | undefined>(undefined);

  const reportViewCenter = React.useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = Math.max(0.1, zoom);
    const screenDx = -pan.x / scale;
    const screenDy = -pan.y / scale;
    const radians = (-canvasRotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    onViewCenterChange({
      x: rect.width / 2 + screenDx * cos - screenDy * sin,
      y: rect.height / 2 + screenDx * sin + screenDy * cos
    });
  }, [canvasRotation, onViewCenterChange, pan.x, pan.y, zoom]);

  React.useEffect(() => {
    reportViewCenter();
  }, [activeCanvasId, reportViewCenter]);

  React.useEffect(() => {
    window.addEventListener("resize", reportViewCenter);
    return () => window.removeEventListener("resize", reportViewCenter);
  }, [reportViewCenter]);

  React.useEffect(() => {
    if (editingCanvasId && !canvasTabs.some((canvas) => canvas.id === editingCanvasId)) {
      setEditingCanvasId(undefined);
    }
  }, [canvasTabs, editingCanvasId]);

  const startCanvasRename = (canvas: CanvasTab) => {
    onCanvas(canvas.id);
    setEditingCanvasId(canvas.id);
    setEditingCanvasName(canvas.name);
  };

  const commitCanvasRename = () => {
    if (!editingCanvasId) return;
    const trimmedName = editingCanvasName.trim();
    onRenameCanvas(editingCanvasId, trimmedName || "Untitled");
    setEditingCanvasId(undefined);
  };

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
  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.currentTarget !== event.target) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panStart.current = { pointerX: event.clientX, pointerY: event.clientY, x: pan.x, y: pan.y, moved: false };
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panStart.current) return;
    const dx = event.clientX - panStart.current.pointerX;
    const dy = event.clientY - panStart.current.pointerY;
    if (Math.abs(dx) + Math.abs(dy) > 3) panStart.current.moved = true;
    setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
  };

  const endPan = () => {
    if (!panStart.current) return;
    const shouldClearSelection = !panStart.current.moved;
    panStart.current = undefined;
    if (shouldClearSelection) onSelect(undefined);
  };

  return (
    <main className="board-wrap">
      <div className="canvas-tabs" onPointerDown={(event) => event.stopPropagation()}>
        {canvasTabs.map((canvas) => (
          <div key={canvas.id} className={`canvas-tab${canvas.id === activeCanvasId ? " active" : ""}`}>
            {editingCanvasId === canvas.id ? (
              <input
                aria-label={`Rename ${canvas.name}`}
                autoFocus
                value={editingCanvasName}
                onChange={(event) => setEditingCanvasName(event.target.value)}
                onBlur={commitCanvasRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitCanvasRename();
                  if (event.key === "Escape") setEditingCanvasId(undefined);
                }}
              />
            ) : (
              <button
                className="canvas-tab-label"
                title="Double-click to rename"
                onClick={() => onCanvas(canvas.id)}
                onDoubleClick={() => startCanvasRename(canvas)}
              >
                {canvas.name.trim() || "Untitled"}
              </button>
            )}
            <button aria-label={`Delete ${canvas.name}`} title="Delete this canvas." disabled={canvasTabs.length <= 1} onClick={() => onDeleteCanvas(canvas.id)}>x</button>
          </div>
        ))}
        <button className="canvas-add-button" title="Add a new canvas tab." onClick={onCreateCanvas}>+ Canvas</button>
      </div>
      <div ref={canvasRef} className="board-canvas" onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
        <div className="board-zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
          <button title="Return to the canvas origin point." onClick={() => setPan({ x: 0, y: 0 })}>Origin</button>
          <button title="Zoom out." onClick={() => onZoom(Math.max(0.4, Number((zoom - 0.1).toFixed(2))))}>-</button>
          <input type="range" min="0.4" max="2.5" step="0.1" value={zoom} onChange={(event) => onZoom(Number(event.target.value))} />
          <button title="Zoom in." onClick={() => onZoom(Math.min(2.5, Number((zoom + 0.1).toFixed(2))))}>+</button>
          <button title="Reset zoom to 100%." onClick={() => onZoom(1)}>{Math.round(zoom * 100)}%</button>
          <label className="canvas-rotation-control">
            Rotate
            <input
              type="number"
              step="1"
              value={canvasRotation}
              onChange={(event) => onCanvasRotation(normalizeRotation(Number(event.target.value)))}
            />
          </label>
          <button title="Reset local canvas rotation." onClick={() => onCanvasRotation(0)}>0 deg</button>
        </div>
        <div className="board-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) rotate(${canvasRotation}deg) scale(${zoom})` }} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
        {boardAsset ? <img className="board-background" src={boardAsset.imageDataUrl} alt={boardAsset.name} /> : !hasBoardContent && <div className="empty-board">Place a board image or start placing pieces.</div>}
        {session.placedImageInstances
          .filter((image) => isOnActiveCanvas(image.canvasId) && !isHidden(image.layerId))
          .map((image) => (
            <PlacedImageView
              key={image.id}
              image={{ ...image, zIndex: effectiveZIndex(layers, image.layerId, image.zIndex) }}
              asset={assetMap.get(image.assetId)}
              selected={session.selectedObjectId === image.id && canInteract(image.layerId)}
              perspectiveRotation={canvasRotation}
              movementScale={zoom}
              interactive={canInteract(image.layerId)}
              onSelect={canInteract(image.layerId) ? () => onSelect(image.id) : noop}
              onDragEnd={canInteract(image.layerId) ? (x, y) => onMove("image", image.id, x, y) : noop}
            />
          ))}
        {session.deckInstances
          .filter((deck) => isOnActiveCanvas(deck.canvasId) && !isHidden(deck.layerId))
          .map((deck) => (
            <DeckInstanceView
              key={deck.id}
              deck={{ ...deck, zIndex: effectiveZIndex(layers, deck.layerId, deck.zIndex) }}
              selected={session.selectedObjectId === deck.id && canInteract(deck.layerId)}
              perspectiveRotation={canvasRotation}
              movementScale={zoom}
              interactive={canInteract(deck.layerId)}
              onSelect={canInteract(deck.layerId) ? () => onSelect(deck.id) : noop}
              onDragEnd={canInteract(deck.layerId) ? (x, y) => onMove("deck", deck.id, x, y) : noop}
              onDraw={canInteract(deck.layerId) ? () => onDrawDeck(deck.id) : noop}
            />
          ))}
        {session.discardPiles
          .filter((pile) => isOnActiveCanvas(pile.canvasId) && !isHidden(pile.layerId))
          .map((pile) => (
            <DiscardPileView
              key={pile.id}
              pile={{ ...pile, zIndex: effectiveZIndex(layers, pile.layerId, pile.zIndex) }}
              selected={session.selectedObjectId === pile.id && canInteract(pile.layerId)}
              perspectiveRotation={canvasRotation}
              movementScale={zoom}
              interactive={canInteract(pile.layerId)}
              onSelect={canInteract(pile.layerId) ? () => onSelect(pile.id) : noop}
              onDragEnd={canInteract(pile.layerId) ? (x, y) => onMove("discard", pile.id, x, y) : noop}
            />
          ))}
        {session.cardInstances
          .filter((card) => card.location === "board" && isOnActiveCanvas(card.canvasId) && !isHidden(card.layerId))
          .map((card) => (
            <CardView
              key={card.id}
              card={{ ...card, zIndex: effectiveZIndex(layers, card.layerId, card.zIndex) }}
              asset={assetMap.get(card.assetId)}
              backAsset={card.backAssetId ? assetMap.get(card.backAssetId) : undefined}
              selected={session.selectedObjectId === card.id && canInteract(card.layerId)}
              perspectiveRotation={canvasRotation}
              movementScale={zoom}
              interactive={canInteract(card.layerId)}
              onSelect={canInteract(card.layerId) ? () => onSelect(card.id) : noop}
              onDragEnd={canInteract(card.layerId) ? (x, y) => onMove("card", card.id, x, y) : noop}
            />
          ))}
        {session.tokenInstances
          .filter((token) => isOnActiveCanvas(token.canvasId) && !isHidden(token.layerId))
          .map((token) => (
            <TokenView
              key={token.id}
              token={{ ...token, zIndex: effectiveZIndex(layers, token.layerId, token.zIndex) }}
              asset={token.assetId ? assetMap.get(token.assetId) : undefined}
              selected={session.selectedObjectId === token.id && canInteract(token.layerId)}
              perspectiveRotation={canvasRotation}
              movementScale={zoom}
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
