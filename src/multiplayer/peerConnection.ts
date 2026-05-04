import { DEFAULT_ICE_SERVERS, type PeerTransport, type SignalCode } from "./multiplayerTypes";

const waitForIceGathering = (connection: RTCPeerConnection) =>
  new Promise<void>((resolve) => {
    if (connection.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const timeout = window.setTimeout(() => {
      connection.removeEventListener("icegatheringstatechange", onStateChange);
      resolve();
    }, 2500);
    const onStateChange = () => {
      if (connection.iceGatheringState === "complete") {
        window.clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }
    };
    connection.addEventListener("icegatheringstatechange", onStateChange);
  });

export class ManualPeer implements PeerTransport {
  peerId: string;
  private connection: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private onMessage: (message: unknown, peerId: string) => void;
  private onStatus: (connected: boolean, peerId: string) => void;

  constructor(
    peerId: string,
    onMessage: (message: unknown, peerId: string) => void,
    onStatus: (connected: boolean, peerId: string) => void
  ) {
    this.peerId = peerId;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.connection = new RTCPeerConnection(DEFAULT_ICE_SERVERS);
    // Static MVP: STUN is enough on many networks, but some users will need TURN.
    // A future signaling service can replace manual copy/paste without changing this transport.
    this.connection.onconnectionstatechange = () => {
      this.onStatus(this.connection.connectionState === "connected", this.peerId);
    };
    this.connection.ondatachannel = (event) => this.attachChannel(event.channel);
  }

  private attachChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => this.onStatus(true, this.peerId);
    channel.onclose = () => this.onStatus(false, this.peerId);
    channel.onerror = () => this.onStatus(false, this.peerId);
    channel.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(event.data), this.peerId);
      } catch {
        this.onMessage({ kind: "ERROR", message: "Received invalid multiplayer data." }, this.peerId);
      }
    };
  }

  async createOffer(): Promise<SignalCode> {
    this.attachChannel(this.connection.createDataChannel("board-game-sandbox"));
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    await waitForIceGathering(this.connection);
    return { type: "offer", sdp: this.connection.localDescription?.toJSON() as RTCSessionDescriptionInit };
  }

  async acceptOfferAndCreateAnswer(offer: SignalCode): Promise<SignalCode> {
    await this.connection.setRemoteDescription(offer.sdp);
    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);
    await waitForIceGathering(this.connection);
    return { type: "answer", sdp: this.connection.localDescription?.toJSON() as RTCSessionDescriptionInit };
  }

  async acceptAnswer(answer: SignalCode) {
    await this.connection.setRemoteDescription(answer.sdp);
  }

  send(message: unknown) {
    if (this.channel?.readyState === "open") {
      this.channel.send(JSON.stringify(message));
    }
  }

  close() {
    this.channel?.close();
    this.connection.close();
    this.onStatus(false, this.peerId);
  }
}
