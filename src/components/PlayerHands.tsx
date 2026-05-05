import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { GameSession } from "../types/game";

interface PlayerHandsProps {
  session: GameSession;
  assets: AssetTemplate[];
  localPlayerId: string;
  isMultiplayer: boolean;
  perspectivePlayerId: string;
  onSetActivePlayer: (playerId: string) => void;
  onSetPerspectivePlayer: (playerId: string) => void;
  onMoveCardToBoard: (cardId: string) => void;
}

export function PlayerHands({
  session,
  assets,
  localPlayerId,
  isMultiplayer,
  perspectivePlayerId,
  onSetActivePlayer,
  onSetPerspectivePlayer,
  onMoveCardToBoard
}: PlayerHandsProps) {
  const assetMap = React.useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const viewPlayerId = isMultiplayer ? localPlayerId : perspectivePlayerId;
  const localPlayer = session.players.find((player) => player.id === localPlayerId);

  if (isMultiplayer) {
    return (
      <section className="hands-panel">
        <div className="player-tabs">
          {session.players.map((player) => (
            <button
              key={player.id}
              className={player.id === session.activePlayerId ? "active" : ""}
              style={{ borderColor: player.color }}
              onClick={() => onSetActivePlayer(player.id)}
            >
              {player.name} ({player.handCardInstanceIds.length})
              {player.id === localPlayerId && <span className="you-badge">You</span>}
            </button>
          ))}
        </div>
        <div className="hand-strip">
          {localPlayer ? (
            <div className="hand-row hand-row-yours">
              <span className="hand-name hand-name-yours" style={{ color: localPlayer.color }}>
                Your Hand
                <em className="hand-card-count">({localPlayer.handCardInstanceIds.length})</em>
              </span>
              <div className="hand-cards">
                {localPlayer.handCardInstanceIds.length === 0 && <span className="hand-empty-hint">No cards in hand</span>}
                {localPlayer.handCardInstanceIds.map((cardId) => {
                  const card = session.cardInstances.find((item) => item.id === cardId);
                  const asset = card ? assetMap.get(card.assetId) : undefined;
                  return (
                    <button key={cardId} className="hand-card" title="Place on Board" onClick={() => onMoveCardToBoard(cardId)}>
                      {asset ? <img src={asset.imageDataUrl} alt={asset.name} /> : "?"}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="hand-no-player muted">You have not been assigned a player slot yet.</p>
          )}
          {session.players
            .filter((player) => player.id !== localPlayerId)
            .map((player) => (
              <div className="hand-row hand-row-other" key={player.id}>
                <span className="hand-name" style={{ color: player.color }}>{player.name}</span>
                <div className="hand-cards hand-cards-hidden">
                  {player.handCardInstanceIds.length === 0 ? (
                    <span className="hand-empty-hint muted">No cards</span>
                  ) : (
                    <>
                      {player.handCardInstanceIds.map((cardId) => (
                        <span key={cardId} className="hand-card hand-card-back" aria-label="Hidden card" />
                      ))}
                      <span className="hand-hidden-count muted">{player.handCardInstanceIds.length} card{player.handCardInstanceIds.length !== 1 ? "s" : ""}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
        </div>
      </section>
    );
  }

  return (
    <section className="hands-panel">
      <div className="player-tabs">
        {session.players.map((player) => (
          <button
            key={player.id}
            className={player.id === session.activePlayerId ? "active" : ""}
            style={{ borderColor: player.color }}
            onClick={() => onSetActivePlayer(player.id)}
          >
            {player.name} ({player.handCardInstanceIds.length})
          </button>
        ))}
        <label className="perspective-select">
          View From
          <select value={perspectivePlayerId} onChange={(event) => onSetPerspectivePlayer(event.target.value)}>
            {session.players.map((player) => (
              <option key={player.id} value={player.id}>{player.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="hand-strip">
        {session.players.map((player) => {
          const isViewing = player.id === viewPlayerId;
          return (
            <div className={`hand-row${isViewing ? " hand-row-yours" : ""}`} key={player.id}>
              <span className={`hand-name${isViewing ? " hand-name-yours" : ""}`} style={{ color: player.color }}>
                {isViewing ? "Your Hand" : player.name}
                {isViewing && <em className="hand-card-count">({player.handCardInstanceIds.length})</em>}
              </span>
              <div className="hand-cards">
                {player.handCardInstanceIds.map((cardId) => {
                  const card = session.cardInstances.find((item) => item.id === cardId);
                  const asset = card ? assetMap.get(card.assetId) : undefined;
                  return (
                    <button key={cardId} className="hand-card" title="Place on Board" onClick={() => onMoveCardToBoard(cardId)}>
                      {asset ? <img src={asset.imageDataUrl} alt={asset.name} /> : "Missing"}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
