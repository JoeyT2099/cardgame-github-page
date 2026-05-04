import React from "react";
import type { AppMode, LobbyState } from "../types/lobby";
import type { NetworkStatus, PeerConnectionStatus } from "../types/multiplayer";

interface MultiplayerPanelProps {
  open: boolean;
  mode: AppMode;
  status: NetworkStatus;
  lobby: LobbyState;
  peers: PeerConnectionStatus[];
  offerCode: string;
  answerCode: string;
  onClose: () => void;
  onLocal: () => void;
  onHost: () => void;
  onJoin: (offerCode: string) => void;
  onAcceptAnswer: (answerCode: string) => void;
  onDisconnect: () => void;
  onSync: () => void;
}

export function MultiplayerPanel(props: MultiplayerPanelProps) {
  const [offerInput, setOfferInput] = React.useState("");
  const [answerInput, setAnswerInput] = React.useState("");
  if (!props.open) return null;

  const copy = async (value: string) => {
    if (value) await navigator.clipboard?.writeText(value);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h2>Multiplayer</h2>
          <button onClick={props.onClose}>Close</button>
        </div>
        <div className="mode-row">
          <button className={props.mode === "local" ? "active" : ""} onClick={props.onLocal}>Local Mode</button>
          <button className={props.mode === "host" ? "active" : ""} onClick={props.onHost}>Host Game</button>
        </div>
        <p>Status: {props.status}</p>
        <div className="multiplayer-help">
          <strong>How manual multiplayer works</strong>
          <p>GitHub Pages cannot run a signaling server, so players exchange one host offer code and one joiner answer code outside the app.</p>
          <ol>
            <li>Host clicks Host Game and sends the offer code to the next player.</li>
            <li>Joiner pastes that offer code under Join Flow, clicks Generate Answer, then sends the answer code back.</li>
            <li>Host pastes that answer code under Host Flow and clicks Accept Answer.</li>
            <li>When connected, the host repeats those steps for Player 3 and Player 4 if needed.</li>
          </ol>
        </div>
        <div className="signal-block">
          <h3>Host Flow</h3>
          <p className="signal-note">Use this section only on the host computer. This offer code invites one player into the next open seat.</p>
          <label>
            1. Send this offer code to the joining player
          <textarea readOnly value={props.offerCode} placeholder="Host offer code appears here" />
          </label>
          <button onClick={() => copy(props.offerCode)}>Copy Offer</button>
          <label>
            2. Paste the answer code they send back
          <textarea value={answerInput} onChange={(event) => setAnswerInput(event.target.value)} placeholder="Paste joiner's answer code here" />
          </label>
          <button onClick={() => props.onAcceptAnswer(answerInput)}>Accept Answer</button>
        </div>
        <div className="signal-block">
          <h3>Join Flow</h3>
          <p className="signal-note">Use this section only on the joining player's computer.</p>
          <label>
            1. Paste the host's offer code here
          <textarea value={offerInput} onChange={(event) => setOfferInput(event.target.value)} placeholder="Paste host offer code here" />
          </label>
          <button onClick={() => props.onJoin(offerInput)}>Generate Answer</button>
          <label>
            2. Send this answer code back to the host
          <textarea readOnly value={props.answerCode} placeholder="Answer code appears here" />
          </label>
          <button onClick={() => copy(props.answerCode)}>Copy Answer</button>
        </div>
        <div className="multiplayer-help compact">
          <strong>Which player am I?</strong>
          <p>The host is Player 1. Each accepted answer fills the next open seat: Player 2, then Player 3, then Player 4. The lobby sidebar shows the current seats.</p>
        </div>
        <div className="connected-list">
          {props.peers.map((peer) => (
            <div className="connected-row" key={peer.peerId}>
              <strong>{peer.label}</strong>
              <em>{peer.connected ? "connected" : "waiting"}</em>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={props.onSync} disabled={props.mode !== "host"}>Sync Full Session</button>
          <button className="danger" onClick={props.onDisconnect}>Disconnect</button>
        </div>
        <p className="muted">Manual codes replace a signaling server for this static GitHub Pages MVP. TURN is not included, so some networks may not connect.</p>
      </div>
    </div>
  );
}
