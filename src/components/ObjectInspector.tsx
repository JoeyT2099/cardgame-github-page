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
  onMoveCardToHand: (cardId: string, playerId: string) => void;
  onMoveCardToDiscard: (cardId: string, discardPileId: string) => void;
  onDrawDeck: (deckInstanceId: string) => void;
  onShuffleDeck: (deckInstanceId: string) => void;
  onResetDeck: (deckInstanceId: string) => void;
}

export function ObjectInspector(props: ObjectInspectorProps) {
  const object = findBoardObject(props.session, props.session.selectedObjectId);
  const [rotationInput, setRotationInput] = React.useState(0);
  const [widthInput, setWidthInput] = React.useState(0);
  const [heightInput, setHeightInput] = React.useState(0);

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
      {object.type === "deck" && (
        <div className="inspector-section">
          <button onClick={() => props.onDrawDeck(object.id)}>Draw Random Card</button>
          <button onClick={() => props.onShuffleDeck(object.id)}>Shuffle Remaining</button>
          <button onClick={() => props.onResetDeck(object.id)}>Reset Deck</button>
          <p>{object.remainingCardAssetIds.length} cards remaining</p>
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
    </aside>
  );
}
