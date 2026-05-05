import type { AssetTemplate, DeckTemplate } from "../types/assets";
import type { GameSession } from "../types/game";
import type { MultiplayerMessage, PeerConnectionStatus } from "../types/multiplayer";
import { ManualPeer } from "./peerConnection";
import { encodeSignalCode, decodeSignalCode } from "./signalingCodes";

export class HostSync {
  private peers = new Map<string, ManualPeer>();
  private statuses = new Map<string, PeerConnectionStatus>();
  private onMessage: (message: MultiplayerMessage, peerId: string) => void;
  private onStatuses: (statuses: PeerConnectionStatus[]) => void;

  constructor(onMessage: (message: MultiplayerMessage, peerId: string) => void, onStatuses: (statuses: PeerConnectionStatus[]) => void) {
    this.onMessage = onMessage;
    this.onStatuses = onStatuses;
  }

  async createInvite() {
    const peerId = crypto.randomUUID();
    const peer = new ManualPeer(
      peerId,
      (message, id) => this.onMessage(message as MultiplayerMessage, id),
      (connected, id) => this.setStatus(id, connected)
    );
    this.peers.set(peerId, peer);
    this.setStatus(peerId, false);
    return { peerId, offerCode: encodeSignalCode(await peer.createOffer()) };
  }

  async acceptAnswer(peerId: string, answerCode: string) {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error("Unknown peer invite.");
    const answer = decodeSignalCode(answerCode);
    if (answer.type !== "answer") throw new Error("Expected an answer code.");
    await peer.acceptAnswer(answer);
    return answer.desiredSeat;
  }

  broadcast(message: MultiplayerMessage) {
    this.peers.forEach((peer) => peer.send(message));
  }

  sendToPeer(peerId: string, message: MultiplayerMessage) {
    this.peers.get(peerId)?.send(message);
  }

  syncFullState(session: GameSession, assets: AssetTemplate[], deckTemplates: DeckTemplate[]) {
    this.broadcast({ kind: "FULL_STATE_SYNC", session, assets, deckTemplates });
  }

  close() {
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.statuses.clear();
    this.onStatuses([]);
  }

  private setStatus(peerId: string, connected: boolean) {
    this.statuses.set(peerId, { peerId, label: `Peer ${this.statuses.size + 1}`, connected });
    this.onStatuses([...this.statuses.values()]);
  }
}
