import type { GameSession } from "../types/game";
import type { SavedSessionRecord } from "../storage/sessionStorage";

interface SessionManagerModalProps {
  sessions: SavedSessionRecord[];
  currentSession: GameSession;
  onClose: () => void;
  onLoad: (session: GameSession) => void;
  onDelete: (id: string) => void;
}

export function SessionManagerModal({ sessions, currentSession, onClose, onLoad, onDelete }: SessionManagerModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h2>Load Session</h2>
          <button onClick={onClose}>Close</button>
        </div>
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
        <p className="muted">Current table: {currentSession.name}</p>
      </div>
    </div>
  );
}
