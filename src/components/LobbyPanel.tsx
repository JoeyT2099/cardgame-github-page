import type { LobbyState } from "../types/lobby";

interface LobbyPanelProps {
  lobby: LobbyState;
  /** The clientId of the local browser session, used to highlight "You" in the seat list. */
  localClientId: string;
  /** The host-assigned playerId for this browser, used after WebRTC join assignment. */
  localPlayerId?: string;
  onMaxPlayers: (maxPlayers: 2 | 3 | 4) => void;
  onName: (name: string) => void;
  onReady: (ready: boolean) => void;
  onOpenMultiplayer: () => void;
  onRefreshFromHost: () => void;
}

export function LobbyPanel({ lobby, localClientId, localPlayerId, onMaxPlayers, onName, onReady, onOpenMultiplayer, onRefreshFromHost }: LobbyPanelProps) {
  const isSelf = (player?: LobbyState["players"][number]) => {
    if (!player) return false;
    if (lobby.mode === "join") return Boolean(localPlayerId && player.playerId === localPlayerId);
    if (localPlayerId) return player.playerId === localPlayerId;
    return player.clientId === localClientId;
  };
  const self = lobby.players.find(isSelf) ?? lobby.players[0];
  const isLocal = lobby.mode === "local";
  const isHost = lobby.mode === "host";
  const seats = Array.from({ length: lobby.maxPlayers }, (_, index) => {
    const seatNumber = index + 1;
    const player = lobby.players.find((item, playerIndex) => (item.seatNumber ?? playerIndex + 1) === seatNumber);
    const fallbackName = isLocal ? (index === 0 ? self?.name || "Player 1" : `Player ${seatNumber}`) : `Player ${seatNumber}`;
    return {
      seatNumber,
      player,
      name: player?.name ?? fallbackName,
      status: player ? (player.connected ? "connected" : "disconnected") : isLocal ? "local seat" : "waiting",
      ready: player?.ready ?? isLocal,
      color: player?.color ?? "#64748b",
      isYou: isSelf(player),
      isHostSeat: player?.isHost ?? false
    };
  });

  return (
    <section className="lobby-panel">
      <h2>Lobby</h2>
      <div className="lobby-help">
        {isLocal && (
          <>
            <strong>Local setup</strong>
            <ol>
              <li>Choose 2, 3, or 4 player seats.</li>
              <li>Hands update automatically for the selected seats.</li>
              <li>Use the hand tabs and View From selector to play each side locally.</li>
            </ol>
          </>
        )}
        {isHost && (
          <>
            <strong>Host setup</strong>
            <ol>
              <li>You are Player 1.</li>
              <li>Open Multiplayer, copy the offer code, and send it to Player 2.</li>
              <li>Paste their answer code. That fills the next open player seat.</li>
              <li>Repeat for Player 3 and Player 4. Seats sync into hands automatically.</li>
            </ol>
          </>
        )}
        {lobby.mode === "join" && (
          <>
            <strong>Join setup</strong>
            <ol>
              <li>Open Multiplayer and paste the host offer code.</li>
              <li>Send the generated answer code back to the host.</li>
              <li>The host assigns you the next open player seat.</li>
            </ol>
          </>
        )}
        <button title="Open multiplayer setup." onClick={onOpenMultiplayer}>{isHost ? "Open Multiplayer Codes" : "Multiplayer Host / Join"}</button>
        {lobby.mode === "join" && (
          <button title="Ask the host to resend the current table, hands, decks, and required assets." onClick={onRefreshFromHost}>
            Client Refresh
          </button>
        )}
      </div>
      <label>
        Your Name
        <input value={self?.name ?? ""} onChange={(event) => onName(event.target.value)} />
      </label>
      <label>
        Players
        <select value={lobby.maxPlayers} disabled={lobby.mode === "join"} onChange={(event) => onMaxPlayers(Number(event.target.value) as 2 | 3 | 4)}>
          <option value={2}>2 players</option>
          <option value={3}>3 players</option>
          <option value={4}>4 players</option>
        </select>
      </label>
      <div className="seat-list" aria-label="Player seats">
        {seats.map((seat) => (
          <div key={seat.seatNumber} className={`seat-row ${seat.player ? "occupied" : ""}`}>
            <span className="seat-color" style={{ background: seat.color }} />
            <div>
              <strong>
                Player {seat.seatNumber}
                {seat.isYou && <span className="you-badge">You</span>}
                {seat.isHostSeat && <span className="host-badge">Host</span>}
              </strong>
              <em>{seat.name}</em>
            </div>
            <small>{seat.ready ? "ready" : seat.status}</small>
          </div>
        ))}
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={self?.ready ?? false} onChange={(event) => onReady(event.target.checked)} />
        Ready
      </label>
      {isHost && lobby.players.length < lobby.maxPlayers && <p className="muted">Waiting for {lobby.maxPlayers - lobby.players.length} more player seat{lobby.maxPlayers - lobby.players.length === 1 ? "" : "s"}.</p>}
    </section>
  );
}
