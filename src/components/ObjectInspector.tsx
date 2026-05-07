import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { DeckTemplate } from "../types/assets";
import type { GameSession, AnyBoardObject, TokenShape } from "../types/game";
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
  onMoveCardToDeck: (cardId: string, deckInstanceId: string, position?: "top" | "bottom") => void;
  onRenameDiscard: (discardPileId: string, name: string) => void;
  onDrawDeck: (deckInstanceId: string, playerId?: string, drawMode?: "top" | "random", chosenCardIndex?: number) => void;
  onShuffleDeck: (deckInstanceId: string) => void;
  onResetDeck: (deckInstanceId: string) => void;
  onReorderDeckCard: (deckInstanceId: string, fromIndex: number, toIndex: number) => void;
  onAssignLayer: (object: AnyBoardObject, layerId: string) => void;
  onTokenColor: (tokenId: string, color: string) => void;
  onTokenShape: (tokenId: string, shape: TokenShape) => void;
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

const tokenShapes: { label: string; value: TokenShape }[] = [
  { label: "Square", value: "square" },
  { label: "Circle", value: "circle" },
  { label: "Triangle", value: "triangle" },
  { label: "Hexagon", value: "hexagon" },
  { label: "Octagon", value: "octagon" }
];

export function ObjectInspector(props: ObjectInspectorProps) {
  const object = findBoardObject(props.session, props.session.selectedObjectId);
  const [rotationInput, setRotationInput] = React.useState(0);
  const [widthInput, setWidthInput] = React.useState(0);
  const [heightInput, setHeightInput] = React.useState(0);
  const [previewAsset, setPreviewAsset] = React.useState<AssetTemplate>();
  const [isExamining, setIsExamining] = React.useState(false);
  const [deckTargetPlayerId, setDeckTargetPlayerId] = React.useState("");
  const assetMap = React.useMemo(() => new Map(props.assets.map((asset) => [asset.id, asset])), [props.assets]);
  const cardMap = React.useMemo(() => new Map(props.session.cardInstances.map((card) => [card.id, card])), [props.session.cardInstances]);

  React.useEffect(() => {
    setRotationInput(object?.rotation ?? 0);
    setWidthInput(object?.width ?? 0);
    setHeightInput(object?.height ?? 0);
  }, [object?.id, object?.rotation, object?.width, object?.height]);

  React.useEffect(() => {
    setPreviewAsset(undefined);
    setIsExamining(false);
  }, [object?.id]);

  React.useEffect(() => {
    if (!deckTargetPlayerId || props.session.players.some((player) => player.id === deckTargetPlayerId)) return;
    setDeckTargetPlayerId("");
  }, [deckTargetPlayerId, props.session.players]);

  const discardPreview = previewAsset ? (
    <div className="hand-card-preview" aria-hidden="true">
      <img src={previewAsset.imageDataUrl} alt="" />
    </div>
  ) : null;

  if (!object) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p>Select a card, deck, pile, token, or image.</p>
      </aside>
    );
  }

  const title = object.type === "deck" || object.type === "discard" ? object.name : object.type;
  const examinedCardAsset = object.type === "card" ? assetMap.get(object.assetId) : undefined;
  const examinedCardBackAsset = object.type === "card" && object.backAssetId ? assetMap.get(object.backAssetId) : undefined;
  const examinedImageAsset = object.type === "image" ? assetMap.get(object.assetId) : undefined;
  const examinedTokenAsset = object.type === "token" && object.assetId ? assetMap.get(object.assetId) : undefined;
  const examinedDiscardTopCard =
    object.type === "discard" && object.cardInstanceIds.length > 0
      ? cardMap.get(object.cardInstanceIds[object.cardInstanceIds.length - 1])
      : undefined;
  const examinedDiscardAsset = examinedDiscardTopCard ? assetMap.get(examinedDiscardTopCard.assetId) : undefined;

  const examinePreview = isExamining ? (
    <div className="examine-preview" role="dialog" aria-label={`Examining ${title}`}>
      <button title="Close the enlarged object preview." onClick={() => setIsExamining(false)}>Close</button>
      {object.type === "card" && object.faceUp && examinedCardAsset && <img src={examinedCardAsset.imageDataUrl} alt={examinedCardAsset.name} />}
      {object.type === "card" && (!object.faceUp || !examinedCardAsset) && (
        examinedCardBackAsset ? <img src={examinedCardBackAsset.imageDataUrl} alt={examinedCardBackAsset.name} /> : <div className="generic-card-back">Card Back</div>
      )}
      {object.type === "image" && examinedImageAsset && <img src={examinedImageAsset.imageDataUrl} alt={examinedImageAsset.name} />}
      {object.type === "token" && (
        <div
          className={`examine-token token-shape-${object.shape ?? "square"}`}
          style={{ background: object.color ?? "hsl(45 93% 60%)" }}
        >
          {examinedTokenAsset ? <img src={examinedTokenAsset.imageDataUrl} alt={examinedTokenAsset.name} /> : <strong>{object.label ?? "Token"}</strong>}
        </div>
      )}
      {object.type === "deck" && (
        <div className="examine-placeholder">
          <strong>{object.name}</strong>
          <span>{object.remainingCardAssetIds.length} cards remaining</span>
        </div>
      )}
      {object.type === "discard" && (
        examinedDiscardAsset ? (
          <>
            <img src={examinedDiscardAsset.imageDataUrl} alt={examinedDiscardAsset.name} />
            <span>{object.name} - {object.cardInstanceIds.length} cards</span>
          </>
        ) : (
          <div className="examine-placeholder">
            <strong>{object.name}</strong>
            <span>Empty discard pile</span>
          </div>
        )
      )}
    </div>
  ) : null;

  return (
    <aside className="inspector">
      {examinePreview}
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
        <button title="Rotate the selected object left." onClick={() => props.onRotate(object, object.rotation - 15)}>Rotate -15</button>
        <button title="Rotate the selected object right." onClick={() => props.onRotate(object, object.rotation + 15)}>Rotate +15</button>
        <button title="Reset object rotation." onClick={() => props.onRotate(object, 0)}>Reset</button>
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
        <button title="Show a large preview of the selected object." onClick={() => setIsExamining(true)}>Examine</button>
        <button title="Move object above others." onClick={() => props.onFront(object)}>Bring to Front</button>
        <button title="Move object behind others." onClick={() => props.onBack(object)}>Send to Back</button>
        {(object.type === "card" || object.type === "token" || object.type === "image") && <button title="Create a copy of this object." onClick={() => props.onDuplicate(object)}>Duplicate</button>}
        <button className="danger" title="Delete the selected object." onClick={() => props.onDelete(object)}>Delete</button>
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
          <label>
            Draw To
            <select value={deckTargetPlayerId} onChange={(event) => setDeckTargetPlayerId(event.target.value)}>
              <option value="">Active / Your Hand</option>
              {props.session.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
          <div className="button-row">
            <button title="Draw the top card to the selected hand." onClick={() => props.onDrawDeck(object.id, deckTargetPlayerId || undefined, "top")}>Draw Top</button>
            <button title="Draw a random card to the selected hand." onClick={() => props.onDrawDeck(object.id, deckTargetPlayerId || undefined, "random")}>Draw Random</button>
          </div>
          <button title="Shuffle the cards still in this deck." onClick={() => props.onShuffleDeck(object.id)}>Shuffle Remaining</button>
          <button title="Restore this deck from its saved template." onClick={() => props.onResetDeck(object.id)}>Reset Deck</button>
          <p>{object.remainingCardAssetIds.length} cards remaining</p>
          {object.remainingCardAssetIds.length === 0 && <p className="muted">Empty deck.</p>}
          <div className="contained-card-list">
            {object.remainingCardAssetIds.map((assetId, index) => {
              const asset = assetMap.get(assetId);
              return (
                <div className="contained-card-row" key={`${assetId}-${index}`}>
                  <div className="discard-card-thumb">
                    {asset ? (
                      <img
                        src={asset.imageDataUrl}
                        alt={asset.name}
                        onMouseEnter={() => setPreviewAsset(asset)}
                        onMouseLeave={() => setPreviewAsset(undefined)}
                        onFocus={() => setPreviewAsset(asset)}
                        onBlur={() => setPreviewAsset(undefined)}
                        tabIndex={0}
                      />
                    ) : "?"}
                  </div>
                  <span title={asset?.name ?? "Missing card"}>{index + 1}. {asset?.name ?? "Missing card"}</span>
                  <button title="Move this card up in the deck." disabled={index === 0} onClick={() => props.onReorderDeckCard(object.id, index, index - 1)}>Up</button>
                  <button title="Move this card down in the deck." disabled={index === object.remainingCardAssetIds.length - 1} onClick={() => props.onReorderDeckCard(object.id, index, index + 1)}>Down</button>
                  <button title="Move this card to the selected hand." onClick={() => props.onDrawDeck(object.id, deckTargetPlayerId || undefined, "top", index)}>Hand</button>
                </div>
              );
            })}
          </div>
          {discardPreview}
        </div>
      )}
      {object.type === "token" && (
        <div className="inspector-section">
          <label>
            Token Shape
            <select value={object.shape ?? "square"} onChange={(event) => props.onTokenShape(object.id, event.target.value as TokenShape)}>
              {tokenShapes.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
            </select>
          </label>
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
          <button title="Flip this card over." onClick={() => props.onFlipCard(object.id)}>{object.faceUp ? "Flip Face Down" : "Flip Face Up"}</button>
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
          <label>
            Return to Deck
            <select onChange={(event) => event.target.value && props.onMoveCardToDeck(object.id, event.target.value, "top")} defaultValue="">
              <option value="">Choose deck</option>
              {props.session.deckInstances.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
            </select>
          </label>
        </div>
      )}
      {object.type === "discard" && (
        <div className="inspector-section">
          <label>
            Discard Name
            <input value={object.name} onChange={(event) => props.onRenameDiscard(object.id, event.target.value)} />
          </label>
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
                    {asset ? (
                      <img
                        src={asset.imageDataUrl}
                        alt={asset.name}
                        onMouseEnter={() => setPreviewAsset(asset)}
                        onMouseLeave={() => setPreviewAsset(undefined)}
                        onFocus={() => setPreviewAsset(asset)}
                        onBlur={() => setPreviewAsset(undefined)}
                        tabIndex={0}
                      />
                    ) : "?"}
                  </div>
                  <span title={asset?.name ?? "Missing card"}>{asset?.name ?? "Missing card"}</span>
                  <button title="Move this card from discard to the board." onClick={() => props.onMoveCardToBoard(cardId, boardX, boardY)}>Board</button>
                  <select onChange={(event) => event.target.value && props.onMoveCardToHand(cardId, event.target.value)} defaultValue="">
                    <option value="">Hand</option>
                    {props.session.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          {discardPreview}
        </div>
      )}
    </aside>
  );
}
