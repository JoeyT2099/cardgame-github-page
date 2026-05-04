import React from "react";
import type { AssetTemplate } from "../types/assets";
import type { GameSession } from "../types/game";

interface PlayerHandsProps {
  session: GameSession;
  assets: AssetTemplate[];
  onSetActivePlayer: (playerId: string) => void;
  onMoveCardToBoard: (cardId: string) => void;
}

export function PlayerHands({ session, assets, onSetActivePlayer, onMoveCardToBoard }: PlayerHandsProps) {
  const assetMap = React.useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

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
      </div>
      <div className="hand-strip">
        {session.players.map((player) => (
          <div className="hand-row" key={player.id}>
            <span className="hand-name" style={{ color: player.color }}>{player.name}</span>
            <div className="hand-cards">
              {player.handCardInstanceIds.map((cardId) => {
                const card = session.cardInstances.find((item) => item.id === cardId);
                const asset = card ? assetMap.get(card.assetId) : undefined;
                return (
                  <button key={cardId} className="hand-card" onClick={() => onMoveCardToBoard(cardId)}>
                    {asset ? <img src={asset.imageDataUrl} alt={asset.name} /> : "Missing"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* TODO: Private hands need encrypted/permissioned views once a backend or richer peer protocol exists. */}
    </section>
  );
}
