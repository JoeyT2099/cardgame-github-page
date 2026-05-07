import { stringifySessionBundle } from "../storage/importExport";
import type { GameSession, SavedGameRecord, SessionBundle } from "../types/game";

interface SessionManagerModalProps {
  games: SavedGameRecord[];
  currentSession: GameSession;
  onClose: () => void;
  onSaveGame: (name: string) => void;
  onLoadGame: (bundle: SessionBundle) => void;
  onDeleteGame: (id: string) => void;
}

const fileSafeName = (name: string, fallback: string) => name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || fallback;

export function SessionManagerModal({ games, currentSession, onClose, onSaveGame, onLoadGame, onDeleteGame }: SessionManagerModalProps) {
  const exportGame = (game: SavedGameRecord) => {
    const exportName = window.prompt("Export game name", game.name);
    if (exportName === null) return;
    const trimmedName = exportName.trim();
    if (!trimmedName) return;
    const bundle: SessionBundle = {
      ...game.bundle,
      kind: "game",
      name: trimmedName,
      exportedAt: Date.now(),
      session: { ...game.bundle.session, name: trimmedName }
    };
    const blob = new Blob([stringifySessionBundle(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileSafeName(trimmedName, "game")}.game.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h2>Games</h2>
          <button title="Close saved games." onClick={onClose}>Close</button>
        </div>
        <section className="manager-section">
          <div className="manager-heading">
            <h3>Saved Games</h3>
            <button
              title="Save the current table as a reusable game."
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
                <button title="Load this saved game." onClick={() => onLoadGame(record.bundle)}>Load Game</button>
                <button title="Export this saved game." onClick={() => exportGame(record)}>Export</button>
                <button className="danger" title="Delete this saved game." onClick={() => onDeleteGame(record.id)}>Delete</button>
              </article>
            ))}
          </div>
        </section>
        <p className="muted">Current table: {currentSession.name}</p>
      </div>
    </div>
  );
}
