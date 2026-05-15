import React from "react";
import type { AssetCategory, AssetFilter, AssetTemplate } from "../types/assets";
import type { TokenShape } from "../types/game";
import { FileUploadButton } from "./FileUploadButton";

interface AssetLibraryModalProps {
  assets: AssetTemplate[];
  placedAssetIds: string[];
  mode: "browse" | "setBoard" | "addToDeck" | "placeImage" | "token";
  onClose: () => void;
  onUpload: (assets: AssetTemplate[]) => void;
  onRename: (assetId: string, name: string) => void;
  onDelete: (assetId: string) => void;
  onCategory: (assetId: string, category: AssetCategory) => void;
  onUseAsBoard: (assetId: string, width: number, height: number) => void;
  onUseAsToken: (assetId: string, width: number, height: number, shape: TokenShape) => void;
  onCreateGenericToken: (width: number, height: number, shape: TokenShape) => void;
  onAddToDeck: (assetId: string) => void;
  onPlaceOnBoard: (assetId: string, width: number, height: number) => void;
  getUsage?: (assetId: string) => string[];
  onError: (message: string) => void;
}

const categories: { label: string; value: AssetFilter }[] = [
  { label: "All", value: "all" },
  { label: "Cards", value: "card" },
  { label: "Boards", value: "board" },
  { label: "Tokens", value: "token" },
  { label: "Decks", value: "deck" },
  { label: "Misc", value: "misc" }
];

const getDefaultSize = (mode: AssetLibraryModalProps["mode"]) => {
  if (mode === "setBoard") return { width: 1400, height: 400 };
  if (mode === "token") return { width: 100, height: 100 };
  return { width: 200, height: 280 };
};

type PlacementOrientation = "original" | "portrait" | "landscape" | "square";

const applyOrientation = (base: { width: number; height: number }, orientation: PlacementOrientation) => {
  const shortSide = Math.min(base.width, base.height);
  const longSide = Math.max(base.width, base.height);
  if (orientation === "portrait") return { width: shortSide, height: longSide };
  if (orientation === "landscape") return { width: longSide, height: shortSide };
  if (orientation === "square") return { width: longSide, height: longSide };
  return base;
};

const fitToOriginalAspect = (asset: AssetTemplate, bounds: { width: number; height: number }) => {
  if (!asset.originalWidth || !asset.originalHeight) return bounds;
  const aspect = asset.originalWidth / asset.originalHeight;
  const maxSide = Math.max(bounds.width, bounds.height);
  return aspect >= 1
    ? { width: maxSide, height: Math.max(24, Math.round(maxSide / aspect)) }
    : { width: Math.max(24, Math.round(maxSide * aspect)), height: maxSide };
};

const tokenShapes: { label: string; value: TokenShape }[] = [
  { label: "Square", value: "square" },
  { label: "Circle", value: "circle" },
  { label: "Triangle", value: "triangle" },
  { label: "Hexagon", value: "hexagon" },
  { label: "Octagon", value: "octagon" }
];

export function AssetLibraryModal(props: AssetLibraryModalProps) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<AssetFilter>("all");
  const [libraryTab, setLibraryTab] = React.useState<"all" | "canvas">("all");
  const [size, setSize] = React.useState(() => getDefaultSize(props.mode));
  const [orientation, setOrientation] = React.useState<PlacementOrientation>("original");
  const [tokenShape, setTokenShape] = React.useState<TokenShape>("square");
  const placedAssetCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    props.placedAssetIds.forEach((assetId) => counts.set(assetId, (counts.get(assetId) ?? 0) + 1));
    return counts;
  }, [props.placedAssetIds]);
  const filtered = props.assets.filter((asset) => {
    const matchesQuery = asset.name.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || asset.category === filter;
    const matchesTab = libraryTab === "all" || placedAssetCounts.has(asset.id);
    return matchesQuery && matchesFilter && matchesTab;
  });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.onClose]);

  React.useEffect(() => {
    const nextOrientation = props.mode === "token" ? "square" : props.mode === "setBoard" ? "landscape" : "original";
    setOrientation(nextOrientation);
    setSize(applyOrientation(getDefaultSize(props.mode), nextOrientation));
    setTokenShape("square");
    if (props.mode === "setBoard") setFilter("board");
    if (props.mode === "token") setFilter("token");
  }, [props.mode]);

  const setPlacementOrientation = (nextOrientation: PlacementOrientation) => {
    setOrientation(nextOrientation);
    setSize(applyOrientation(getDefaultSize(props.mode), nextOrientation));
  };

  const setDimension = (dimension: "width" | "height", value: number) => {
    setSize((current) => ({
      ...current,
      [dimension]: Math.max(24, Math.min(2000, Math.floor(Number.isFinite(value) ? value : current[dimension])))
    }));
  };

  const isPlacementMode = props.mode === "setBoard" || props.mode === "placeImage" || props.mode === "token";
  const boardSize = props.mode === "setBoard" ? size : getDefaultSize("setBoard");
  const tokenSize = props.mode === "token" ? size : getDefaultSize("token");
  const imageSize = props.mode === "placeImage" ? size : getDefaultSize("placeImage");
  const getPlacementSize = (asset: AssetTemplate, baseSize: { width: number; height: number }) =>
    orientation === "original" ? fitToOriginalAspect(asset, baseSize) : baseSize;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal wide-modal">
        <div className="modal-header">
          <h2>Asset Library</h2>
          <button title="Close the asset library." onClick={props.onClose}>Close</button>
        </div>
        <div className="library-tabs" role="tablist" aria-label="Asset views">
          <button
            type="button"
            role="tab"
            aria-selected={libraryTab === "all"}
            className={libraryTab === "all" ? "active" : ""}
            title="Show every asset in the library."
            onClick={() => setLibraryTab("all")}
          >
            All Assets
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={libraryTab === "canvas"}
            className={libraryTab === "canvas" ? "active" : ""}
            title="Show only assets currently placed on the active canvas."
            onClick={() => setLibraryTab("canvas")}
          >
            On Canvas <span>{placedAssetCounts.size}</span>
          </button>
        </div>
        <div className="library-tools">
          <FileUploadButton label="Upload Images" category={props.mode === "setBoard" ? "board" : props.mode === "token" ? "token" : "card"} onAssets={props.onUpload} onError={props.onError} />
          <input placeholder="Search assets" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={filter} onChange={(event) => setFilter(event.target.value as AssetFilter)}>
            {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          {isPlacementMode && (
            <div className="placement-size-controls">
              <label>
                W
                <input type="number" min="24" max="2000" value={size.width} onChange={(event) => setDimension("width", Number(event.target.value))} />
              </label>
              <label>
                H
                <input type="number" min="24" max="2000" value={size.height} onChange={(event) => setDimension("height", Number(event.target.value))} />
              </label>
              <label className="placement-orientation-control">
                Orientation
                <select value={orientation} onChange={(event) => setPlacementOrientation(event.target.value as PlacementOrientation)}>
                  <option value="original">Original</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                  <option value="square">Square</option>
                </select>
              </label>
              {props.mode === "token" && (
                <>
                  <label className="placement-shape-control">
                    Shape
                    <select value={tokenShape} onChange={(event) => setTokenShape(event.target.value as TokenShape)}>
                      {tokenShapes.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
                    </select>
                  </label>
                  <button type="button" title="Place a generic colored token." onClick={() => props.onCreateGenericToken(size.width, size.height, tokenShape)}>Generic Token</button>
                </>
              )}
            </div>
          )}
        </div>
        {libraryTab === "canvas" && placedAssetCounts.size === 0 && (
          <div className="asset-empty-state">No asset-backed objects are placed on this canvas.</div>
        )}
        <div className="asset-grid">
          {filtered.map((asset) => {
            const usage = props.getUsage?.(asset.id) ?? [];
            const placedCount = placedAssetCounts.get(asset.id) ?? 0;
            return (
              <article className="asset-card" key={asset.id}>
                <img src={asset.imageDataUrl} alt={asset.name} />
                {libraryTab === "canvas" && <span className="asset-placement-badge">{placedCount} placed</span>}
                <input value={asset.name} onChange={(event) => props.onRename(asset.id, event.target.value)} />
                <select value={asset.category} onChange={(event) => props.onCategory(asset.id, event.target.value as AssetCategory)}>
                  <option value="card">Card</option>
                  <option value="board">Board</option>
                  <option value="token">Token</option>
                  <option value="deck">Deck</option>
                  <option value="misc">Misc</option>
                </select>
                {usage.length > 0 && <small className="asset-usage">Used in {usage.join(", ")}</small>}
                <div className="asset-actions">
                  {(props.mode === "browse" || props.mode === "setBoard") && <button title="Place this image as a board." onClick={() => {
                    const placementSize = getPlacementSize(asset, boardSize);
                    props.onUseAsBoard(asset.id, placementSize.width, placementSize.height);
                  }}>Use as Board</button>}
                  {(props.mode === "browse" || props.mode === "token") && <button title="Place this image as a token." onClick={() => {
                    const placementSize = getPlacementSize(asset, tokenSize);
                    props.onUseAsToken(asset.id, placementSize.width, placementSize.height, tokenShape);
                  }}>Use as Token</button>}
                  {(props.mode === "browse" || props.mode === "addToDeck") && <button title="Use this image in deck creation." onClick={() => props.onAddToDeck(asset.id)}>Add to Deck</button>}
                  {(props.mode === "browse" || props.mode === "placeImage") && <button title="Place this image on the canvas." onClick={() => {
                    const placementSize = getPlacementSize(asset, imageSize);
                    props.onPlaceOnBoard(asset.id, placementSize.width, placementSize.height);
                  }}>Place</button>}
                  <button className="danger asset-delete-button" title="Delete this asset from the library." onClick={() => props.onDelete(asset.id)}>Delete Asset</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
