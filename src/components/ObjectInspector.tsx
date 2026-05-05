import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { DeckTemplate } from "../types/assets";
import type { GameSession, AnyBoardObject } from "../types/game";
import { findBoardObject } from "../store/selectors";

interface ObjectInspectorProps {
  session: GameSession;
  assets: AssetTemplate[];
  deckTemplates: DeckTemplate[];
  onRotate: (object: AnyBoardObject, rotation: number) => void;
  onResize: (object: AnyBoardObject, width: number, height: number) => void;
  onDelete: (object: AnyBoardObject) => void;
  onDuplicate: (object: AnyBoardObject) => void;
  onFront: (object: AnyBoardObject) => void;
  onBack: (object: AnyBoardObject) => void;
  onFlipCard: (cardId: string) => void;
  onMoveCardToBoard: (cardId: string, x: number, y: number) => void;
  onMoveCardToHand: (cardId: string, playerId: string) => void;
  onMoveCardToDiscard: (cardId: string, discardPileId: string) => void;
  onDrawDeck: (deckInstanceId: string) => void;
  onShuffleDeck: (deckInstanceId: string) => void;
  onResetDeck: (deckInstanceId: string) => void;
  onAssignLayer: (object: AnyBoardObject, layerId: string) => void;
  onTokenColor: (tokenId: string, color: string) => void;
}

const colorToHue = (color = "hsl(45 93% 60%)") => {
  const hslMatch = color.match(/hsl\(\s*(\d+(?:\.\d+)?)/i);
  if (hslMatch) return Number(hslMatch[1]);
  const hexMatch = color.match(/^#?([0-9a-f]{6})$/i);
  if (!hexMatch) return 45;
  const value = hexMatch[1];
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  const hue =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return Math.round((hue * 60 + 360) % 360);
};

const tokenColorFromHue = (hue: number) => `hsl(${hue} 93% 60%)`;

export function ObjectInspector(props: ObjectInspectorProps) {
  const object = findBoardObject(props.session, props.session.selectedObjectId);
  const [rotationInput, setRotationInput] = React.useState(0);
  const [widthInput, setWidthInput] = React.useState(0);
  const [heightInput, setHeightInput] = React.useState(0);
  const assetMap = React.useMemo(() => new Map(props.assets.map((asset) => [asset.id, asset])), [props.assets]);

  React.useEffect(() => {
    setRotationInput(object?.rotation ?? 0);
    setWidthInput(object?.width ?? 0);
    setHeightInput(object?.height ?? 0);
  }, [object?.id, object?.rotation, object?.width, object?.height]);

  if (!object) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p>Select a card, deck, pile, token, or image.</p>
      </aside>
    );
  }

  const title = object.type === "deck" ? object.name : object.type;

  return (
    <aside className="inspector">
      <h2>Inspector</h2>
      <div className="selected-title">{title}</div>
      <label>
        Rotation
        <input
          type="number"
          value={rotationInput}
          onChange={(event) => setRotationInput(Number(event.target.value))}
          onBlur={() => props.onRotate(object, rotationInput)}
        />
      </label>
      <div className="button-row">
        <button onClick={() => props.onRotate(object, object.rotation - 15)}>Rotate -15</button>
        <button onClick={() => props.onRotate(object, object.rotation + 15)}>Rotate +15</button>
        <button onClick={() => props.onRotate(object, 0)}>Reset</button>
      </div>
      <div className="size-grid">
        <label>
          Width
          <input type="number" min="24" value={widthInput} onChange={(event) => setWidthInput(Number(event.target.value))} onBlur={() => props.onResize(object, widthInput, heightInput)} />
        </label>
        <label>
          Height
          <input type="number" min="24" value={heightInput} onChange={(event) => setHeightInput(Number(event.target.value))} onBlur={() => props.onResize(object, widthInput, heightInput)} />
        </label>
      </div>
      <div className="button-grid">
        <button onClick={() => props.onFront(object)}>Bring to Front</button>
        <button onClick={() => props.onBack(object)}>Send to Back</button>
        {(object.type === "card" || object.type === "token" || object.type === "image") && <button onClick={() => props.onDuplicate(object)}>Duplicate</button>}
        <button className="danger" onClick={() => props.onDelete(object)}>Delete</button>
      </div>
      {props.session.layers.length > 0 && (
        <label>
          Layer
          <select
            value={object.layerId ?? ""}
            onChange={(e) => e.target.value && props.onAssignLayer(object, e.target.value)}
          >
            {[...props.session.layers].sort((a, b) => b.order - a.order).map((layer) => (
              <option key={layer.id} value={layer.id}>{layer.name}</option>
            ))}
          </select>
        </label>
      )}
      {object.type === "deck" && (
        <div className="inspector-section">
          <button onClick={() => props.onDrawDeck(object.id)}>Draw Random Card</button>
          <button onClick={() => props.onShuffleDeck(object.id)}>Shuffle Remaining</button>
          <button onClick={() => props.onResetDeck(object.id)}>Reset Deck</button>
          <p>{object.remainingCardAssetIds.length} cards remaining</p>
        </div>
      )}
      {object.type === "token" && !object.assetId && (
        <div className="inspector-section">
          <label className="token-color-slider">
            Token Color
            <span style={{ background: object.color ?? "hsl(45 93% 60%)" }} />
            <input
              type="range"
              min="0"
              max="360"
              value={colorToHue(object.color)}
              onChange={(event) => props.onTokenColor(object.id, tokenColorFromHue(Number(event.target.value)))}
            />
          </label>
        </div>
      )}
      {object.type === "card" && (
        <div className="inspector-section">
          <button onClick={() => props.onFlipCard(object.id)}>{object.faceUp ? "Flip Face Down" : "Flip Face Up"}</button>
          <label>
            Return to Hand
            <select onChange={(event) => event.target.value && props.onMoveCardToHand(object.id, event.target.value)} defaultValue="">
              <option value="">Choose player</option>
              {props.session.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
          <label>
            Move to Discard
            <select onChange={(event) => event.target.value && props.onMoveCardToDiscard(object.id, event.target.value)} defaultValue="">
              <option value="">Choose pile</option>
              {props.session.discardPiles.map((pile) => <option key={pile.id} value={pile.id}>{pile.name}</option>)}
            </select>
          </label>
        </div>
      )}
      {object.type === "discard" && (
        <div className="inspector-section">
          <h3>Discarded Cards</h3>
          {object.cardInstanceIds.length === 0 && <p className="muted">Empty discard pile.</p>}
          <div className="discard-card-list">
            {object.cardInstanceIds.map((cardId, index) => {
              const card = props.session.cardInstances.find((item) => item.id === cardId);
              const asset = card ? assetMap.get(card.assetId) : undefined;
              const boardX = object.x + object.width + 18;
              const boardY = object.y + index * 18;
              return (
                <div className="discard-card-row" key={cardId}>
                  <div className="discard-card-thumb">
                    {asset ? <img src={asset.imageDataUrl} alt={asset.name} /> : "?"}
                  </div>
                  <span title={asset?.name ?? "Missing card"}>{asset?.name ?? "Missing card"}</span>
                  <button onClick={() => props.onMoveCardToBoard(cardId, boardX, boardY)}>Board</button>
                  <select onChange={(event) => event.target.value && props.onMoveCardToHand(cardId, event.target.value)} defaultValue="">
                    <option value="">Hand</option>
                    {props.session.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
