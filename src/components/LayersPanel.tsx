import React from "react";
import type { Layer } from "../types/game";

interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  defaultLayerId: string;
  onActivate: (layerId: string) => void;
  onToggleVisible: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onRename: (layerId: string, name: string) => void;
  onDelete: (layerId: string) => void;
  onCreate: () => void;
  onMoveUp: (layerId: string) => void;
  onMoveDown: (layerId: string) => void;
}

export function LayersPanel({ layers, activeLayerId, defaultLayerId, onActivate, onToggleVisible, onToggleLock, onRename, onDelete, onCreate, onMoveUp, onMoveDown }: LayersPanelProps) {
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined);
  const [editingName, setEditingName] = React.useState("");
  const sorted = [...layers].sort((a, b) => b.order - a.order);

  const startRename = (layer: Layer) => {
    setEditingId(layer.id);
    setEditingName(layer.name);
  };

  const commitRename = (layerId: string) => {
    if (editingName.trim()) onRename(layerId, editingName.trim());
    setEditingId(undefined);
  };

  return (
    <section className="side-section">
      <h2>Layers</h2>
      <div className="layers-list">
        {sorted.map((layer) => {
          const isDefaultLayer = layer.id === defaultLayerId;
          return (
            <div
              key={layer.id}
              className={`layer-row${layer.id === activeLayerId ? " layer-active" : ""}`}
              onClick={() => onActivate(layer.id)}
            >
            <div className="layer-controls">
              <button
                className={`layer-icon-btn${layer.visible ? "" : " layer-icon-off"}`}
                title={isDefaultLayer ? "Default layer stays visible" : layer.visible ? "Hide layer" : "Show layer"}
                onClick={(e) => { e.stopPropagation(); onToggleVisible(layer.id); }}
                disabled={isDefaultLayer}
              >
                {layer.visible ? "👁" : "🚫"}
              </button>
              <button
                className={`layer-icon-btn${layer.locked ? " layer-icon-active" : ""}`}
                title={isDefaultLayer ? "Default layer stays unlocked" : layer.locked ? "Unlock layer" : "Lock layer"}
                onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                disabled={isDefaultLayer}
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>
            </div>
            <div className="layer-name-wrap">
              {editingId === layer.id ? (
                <input
                  className="layer-name-input"
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => commitRename(layer.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitRename(layer.id); if (e.key === "Escape") setEditingId(undefined); }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="layer-name"
                  title={isDefaultLayer ? "Default layer cannot be deleted" : "Double-click to rename"}
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(layer); }}
                >
                  {layer.name}
                  {isDefaultLayer && <small className="layer-default-badge">Default</small>}
                </span>
              )}
            </div>
            <div className="layer-order-btns">
              <button className="layer-icon-btn" title="Move layer up" onClick={(e) => { e.stopPropagation(); onMoveUp(layer.id); }}>▲</button>
              <button className="layer-icon-btn" title="Move layer down" onClick={(e) => { e.stopPropagation(); onMoveDown(layer.id); }}>▼</button>
              <button
                className="layer-icon-btn layer-delete-btn"
                title={isDefaultLayer ? "Default layer cannot be deleted" : "Delete layer"}
                onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
                disabled={isDefaultLayer || layers.length <= 1}
              >
                ✕
              </button>
            </div>
            </div>
          );
        })}
      </div>
      <button className="layer-add-btn" onClick={onCreate}>+ Add Layer</button>
    </section>
  );
}
