import React from "react";
import type { AppMode, LobbyState } from "../types/lobby";
import type { NetworkStatus, PeerConnectionStatus } from "../types/multiplayer";

interface MultiplayerPanelProps {
  open: boolean;
  mode: AppMode;
  status: NetworkStatus;
  lobby: LobbyState;
  peers: PeerConnectionStatus[];
  pendingInvites: { peerId: string; offerCode: string; createdAt: number }[];
  selectedInvitePeerId: string;
  answerCode: string;
  onClose: () => void;
  onLocal: () => void;
  onHost: () => void;
  onSelectInvite: (peerId: string) => void;
  onJoin: (offerCode: string) => void;
  onAcceptAnswer: (answerCode: string) => void;
  onDisconnect: () => void;
  onDisconnectPeer: (peerId: string) => void;
  onSync: () => void;
  onRefreshFromHost: () => void;
}

export function MultiplayerPanel(props: MultiplayerPanelProps) {
  const [screen, setScreen] = React.useState<"choose" | "host" | "join">("choose");
  const [offerInput, setOfferInput] = React.useState("");
  const [answerInput, setAnswerInput] = React.useState("");

  React.useEffect(() => {
    if (!props.open) return;
    if (props.mode === "host") setScreen("host");
    else if (props.mode === "join") setScreen("join");
    else setScreen("choose");
  }, [props.open, props.mode]);

  if (!props.open) return null;

  const copy = async (value: string) => {
    if (value) await navigator.clipboard?.writeText(value);
  };

  const openHost = () => {
    setScreen("host");
    props.onHost();
  };

  const openJoin = () => {
    setScreen("join");
  };
  const selectedInvite = props.pendingInvites.find((invite) => invite.peerId === props.selectedInvitePeerId) ?? props.pendingInvites[0];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h2>Multiplayer</h2>
          <button title="Close multiplayer setup." onClick={props.onClose}>Close</button>
        </div>
        <p>Status: {props.status}</p>
        {screen === "choose" && (
          <>
            <div className="multiplayer-help">
              <strong>Choose this browser's role</strong>
              <p>Only one browser should host the table. Every other browser should join with an offer code from the host.</p>
            </div>
            <div className="role-choice-grid">
              <button className="role-choice-card" title="Host this multiplayer game." onClick={openHost}>
                <strong>Host Game</strong>
                <span>Create the table as Player 1 and generate offer codes for other players.</span>
              </button>
              <button className="role-choice-card" title="Join another host's game." onClick={openJoin}>
                <strong>Join Game</strong>
                <span>Use an offer code from the host and choose Player 2, 3, or 4.</span>
              </button>
            </div>
          </>
        )}
        {screen === "host" && (
          <>
            <div className="modal-subheader">
              <button title="Return to role selection." onClick={() => setScreen("choose")}>Back</button>
              <h3>Host Game</h3>
            </div>
            <div className="multiplayer-help">
              <strong>Host window</strong>
              <p>This browser is Player 1. Create one offer code per joining player, then accept that player's answer code.</p>
            </div>
            <div className="signal-block">
              <button title="Create an offer code for one joining player." onClick={props.onHost}>{props.pendingInvites.length > 0 ? "Create Another Offer" : "Create Host Offer"}</button>
              {props.pendingInvites.length > 0 && (
                <label>
                  Pending Offer
                  <select value={selectedInvite?.peerId ?? ""} onChange={(event) => props.onSelectInvite(event.target.value)}>
                    {props.pendingInvites.map((invite, index) => (
                      <option key={invite.peerId} value={invite.peerId}>
                        Offer {index + 1} - {new Date(invite.createdAt).toLocaleTimeString()}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                1. Send this offer code to the joining player
                <textarea readOnly value={selectedInvite?.offerCode ?? ""} placeholder="Host offer code appears here" />
              </label>
              <button title="Copy this offer code." onClick={() => copy(selectedInvite?.offerCode ?? "")} disabled={!selectedInvite}>Copy Offer</button>
              <label>
                2. Paste the answer code they send back
                <textarea value={answerInput} onChange={(event) => setAnswerInput(event.target.value)} placeholder="Paste joiner's answer code here" />
              </label>
              <button title="Accept this answer and seat the joining player." onClick={() => props.onAcceptAnswer(answerInput)} disabled={!selectedInvite || !answerInput.trim()}>Accept Answer</button>
            </div>
            <div className="connected-list">
              {props.peers.map((peer) => (
                <div className="connected-row" key={peer.peerId}>
                  <strong>{peer.label}</strong>
                  <em>{peer.connected ? "connected" : "waiting"}</em>
                  <button title="Disconnect this player so they can join again with a new offer." onClick={() => props.onDisconnectPeer(peer.peerId)}>
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {screen === "join" && (
          <>
            <div className="modal-subheader">
              <button title="Return to role selection." onClick={() => setScreen("choose")}>Back</button>
              <h3>Join Game</h3>
            </div>
            <div className="multiplayer-help">
              <strong>Join window</strong>
              <p>This browser is not the host. Paste the host's offer code, then send the generated answer back. The host assigns the next available player seat.</p>
            </div>
            <div className="signal-block">
              <label>
                1. Paste the host's offer code here
                <textarea value={offerInput} onChange={(event) => setOfferInput(event.target.value)} placeholder="Paste host offer code here" />
              </label>
              <button title="Generate an answer code for the host. The host assigns the next available player seat." onClick={() => props.onJoin(offerInput)} disabled={!offerInput.trim()}>Generate Answer</button>
              <label>
                2. Send this answer code back to the host
                <textarea readOnly value={props.answerCode} placeholder="Answer code appears here" />
              </label>
              <button title="Copy this answer code." onClick={() => copy(props.answerCode)} disabled={!props.answerCode}>Copy Answer</button>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button title="Send the full current session to connected players." onClick={props.onSync} disabled={props.mode !== "host"}>Sync Full Session</button>
          <button title="Ask the host to resend the current table, hands, decks, and required assets." onClick={props.onRefreshFromHost} disabled={props.mode !== "join"}>Client Refresh</button>
          <button title="Return to local-only play." onClick={props.onLocal}>Local Mode</button>
          <button className="danger" title="Disconnect multiplayer." onClick={props.onDisconnect}>Disconnect</button>
        </div>
        <p className="muted">Manual codes replace a signaling server for this static GitHub Pages MVP. TURN is not included, so some networks may not connect.</p>
      </div>
    </div>
  );
}
