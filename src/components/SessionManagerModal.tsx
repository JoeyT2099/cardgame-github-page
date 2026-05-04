import { stringifySessionBundle } from "../storage/importExport";
import type { GameSession, SavedGameRecord, SessionBundle } from "../types/game";
import type { SavedSessionRecord } from "../storage/sessionStorage";

interface SessionManagerModalProps {
  sessions: SavedSessionRecord[];
  games: SavedGameRecord[];
  currentSession: GameSession;
  onClose: () => void;
  onLoad: (session: GameSession) => void;
  onDelete: (id: string) => void;
  onSaveGame: (name: string) => void;
  onLoadGame: (bundle: SessionBundle) => void;
  onDeleteGame: (id: string) => void;
}

export function SessionManagerModal({ sessions, games, currentSession, onClose, onLoad, onDelete, onSaveGame, onLoadGame, onDeleteGame }: SessionManagerModalProps) {
  const exportGame = (game: SavedGameRecord) => {
    const blob = new Blob([stringifySessionBundle(game.bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${game.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "game"}.game.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h2>Sessions & Games</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <section className="manager-section">
          <div className="manager-heading">
            <h3>Saved Games</h3>
            <button
              onClick={() => {
                const name = window.prompt("Game name", currentSession.name);
                if (name) onSaveGame(name);
              }}
            >
              Save Current as Game
            </button>
          </div>
          <p className="muted">Games bundle the current table, board image, decks, tokens, placed images, layers, and required assets.</p>
          <div className="session-list">
            {games.length === 0 && <p>No saved games yet.</p>}
            {games.map((record) => (
              <article key={record.id} className="session-row game-row">
                <div>
                  <strong>{record.name}</strong>
                  <span>{new Date(record.updatedAt).toLocaleString()}</span>
                </div>
                <button onClick={() => onLoadGame(record.bundle)}>Load Game</button>
                <button onClick={() => exportGame(record)}>Export</button>
                <button className="danger" onClick={() => onDeleteGame(record.id)}>Delete</button>
              </article>
            ))}
          </div>
        </section>
        <section className="manager-section">
          <h3>Saved Sessions</h3>
        <div className="session-list">
          {sessions.length === 0 && <p>No saved sessions yet.</p>}
          {sessions.map((record) => (
            <article key={record.id} className="session-row">
              <div>
                <strong>{record.name}</strong>
                <span>{new Date(record.updatedAt).toLocaleString()}</span>
              </div>
              <button onClick={() => onLoad(record.session)}>Load</button>
              <button className="danger" onClick={() => onDelete(record.id)}>Delete</button>
            </article>
          ))}
        </div>
        </section>
        <p className="muted">Current table: {currentSession.name}</p>
      </div>
    </div>
  );
}
