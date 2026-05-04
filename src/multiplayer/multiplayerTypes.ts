export const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export interface SignalCode {
  type: "offer" | "answer";
  sdp: RTCSessionDescriptionInit;
}

export interface PeerTransport {
  peerId: string;
  send: (message: unknown) => void;
  close: () => void;
}
