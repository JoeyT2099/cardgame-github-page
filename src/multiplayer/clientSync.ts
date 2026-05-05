import type { MultiplayerMessage } from "../types/multiplayer";
import { ManualPeer } from "./peerConnection";
import { decodeSignalCode, encodeSignalCode } from "./signalingCodes";

export class ClientSync {
  private peer?: ManualPeer;
  private onMessage: (message: MultiplayerMessage) => void;
  private onStatus: (connected: boolean) => void;

  constructor(onMessage: (message: MultiplayerMessage) => void, onStatus: (connected: boolean) => void) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  async joinFromOffer(offerCode: string, desiredSeat: 2 | 3 | 4) {
    const offer = decodeSignalCode(offerCode);
    if (offer.type !== "offer") throw new Error("Expected a host offer code.");
    this.peer = new ManualPeer(
      "host",
      (message) => this.onMessage(message as MultiplayerMessage),
      (connected) => this.onStatus(connected)
    );
    const answer = await this.peer.acceptOfferAndCreateAnswer(offer);
    answer.desiredSeat = desiredSeat;
    return encodeSignalCode(answer);
  }

  send(message: MultiplayerMessage) {
    this.peer?.send(message);
  }

  close() {
    this.peer?.close();
    this.peer = undefined;
    this.onStatus(false);
  }
}
