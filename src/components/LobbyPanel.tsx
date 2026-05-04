import type { LobbyState } from "../types/lobby";

interface LobbyPanelProps {
  lobby: LobbyState;
  onMaxPlayers: (maxPlayers: 2 | 3 | 4) => void;
  onName: (name: string) => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
}

export function LobbyPanel({ lobby, onMaxPlayers, onName, onReady, onStart }: LobbyPanelProps) {
  const self = lobby.players[0];
  const canStart = lobby.mode !== "join" && lobby.players.length >= 1 && lobby.players.every((player) => player.ready || player.isHost);
  return (
    <section className="lobby-panel">
      <h2>Lobby</h2>
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
      <div className="connected-list">
        {lobby.players.map((player) => (
          <div key={player.clientId} className="connected-row">
            <span style={{ background: player.color }} />
            <strong>{player.name}</strong>
            <em>{player.connected ? "connected" : "disconnected"}</em>
            <small>{player.ready ? "ready" : "not ready"}</small>
          </div>
        ))}
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={self?.ready ?? false} onChange={(event) => onReady(event.target.checked)} />
        Ready
      </label>
      {lobby.mode !== "join" && <button disabled={!canStart} onClick={onStart}>Start Game</button>}
    </section>
  );
}
