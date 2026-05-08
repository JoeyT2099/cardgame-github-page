import { DEFAULT_ICE_SERVERS, type PeerTransport, type SignalCode } from "./multiplayerTypes";

const CHUNK_KIND = "__cardgame_chunk";
const CHUNK_SIZE = 12_000;
const MAX_CHUNK_AGE_MS = 60_000;
const BUFFER_HIGH_WATER_MARK = 256_000;
const BUFFER_LOW_WATER_MARK = 64_000;
const FULL_STATE_REPLACE_KEY = "FULL_STATE_SYNC";

interface ChunkEnvelope {
  kind: typeof CHUNK_KIND;
  id: string;
  index: number;
  total: number;
  data: string;
}

interface PendingFrame {
  data: string;
  replaceKey?: string;
}

const isChunkEnvelope = (value: unknown): value is ChunkEnvelope => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChunkEnvelope>;
  return (
    candidate.kind === CHUNK_KIND &&
    typeof candidate.id === "string" &&
    typeof candidate.index === "number" &&
    typeof candidate.total === "number" &&
    typeof candidate.data === "string"
  );
};

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
  private pendingMessages: PendingFrame[] = [];
  private flushTimer?: number;
  private receivedChunks = new Map<string, { chunks: string[]; received: number; total: number; createdAt: number }>();
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
    channel.bufferedAmountLowThreshold = BUFFER_LOW_WATER_MARK;
    channel.onopen = () => {
      this.onStatus(true, this.peerId);
      this.flushPendingMessages();
    };
    channel.onbufferedamountlow = () => this.flushPendingMessages();
    channel.onclose = () => this.onStatus(false, this.peerId);
    channel.onerror = () => this.onStatus(false, this.peerId);
    channel.onmessage = (event) => {
      try {
        this.handleRawMessage(String(event.data));
      } catch {
        this.onMessage({ kind: "ERROR", message: "Received invalid multiplayer data." }, this.peerId);
      }
    };
  }

  async createOffer(): Promise<SignalCode> {
    this.attachChannel(this.connection.createDataChannel("cardgame-sandbox"));
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
    const encoded = JSON.stringify(message);
    const replaceKey = this.getReplaceKey(message);
    if (replaceKey) {
      this.pendingMessages = this.pendingMessages.filter((frame) => frame.replaceKey !== replaceKey);
    }
    const frames = this.encodeFrames(encoded).map((data) => ({ data, replaceKey }));
    this.pendingMessages.push(...frames);
    // Host-side lobby/session sync can be produced immediately after an answer is accepted,
    // before the DataChannel has fired "open". Queue it so joiners receive the first state.
    this.flushPendingMessages();
  }

  private flushPendingMessages() {
    if (this.channel?.readyState !== "open" || this.pendingMessages.length === 0) return;
    while (this.pendingMessages.length > 0 && this.channel.bufferedAmount < BUFFER_HIGH_WATER_MARK) {
      const next = this.pendingMessages.shift();
      if (!next) break;
      try {
        this.channel.send(next.data);
      } catch {
        this.pendingMessages.unshift(next);
        this.scheduleFlush();
        return;
      }
    }
    if (this.pendingMessages.length > 0) this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimer !== undefined) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = undefined;
      this.flushPendingMessages();
    }, 50);
  }

  private encodeFrames(encoded: string) {
    if (encoded.length <= CHUNK_SIZE) return [encoded];
    const id = crypto.randomUUID();
    const total = Math.ceil(encoded.length / CHUNK_SIZE);
    return Array.from({ length: total }, (_, index) =>
      JSON.stringify({
        kind: CHUNK_KIND,
        id,
        index,
        total,
        data: encoded.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
      } satisfies ChunkEnvelope)
    );
  }

  private getReplaceKey(message: unknown) {
    if (!message || typeof message !== "object") return undefined;
    const candidate = message as { kind?: unknown; assets?: unknown[]; deckTemplates?: unknown[] };
    return candidate.kind === FULL_STATE_REPLACE_KEY &&
      Array.isArray(candidate.assets) &&
      candidate.assets.length === 0 &&
      Array.isArray(candidate.deckTemplates) &&
      candidate.deckTemplates.length === 0
      ? FULL_STATE_REPLACE_KEY
      : undefined;
  }

  private handleRawMessage(raw: string) {
    const parsed = JSON.parse(raw);
    if (!isChunkEnvelope(parsed)) {
      this.onMessage(parsed, this.peerId);
      return;
    }
    const reassembled = this.receiveChunk(parsed);
    if (!reassembled) return;
    this.onMessage(JSON.parse(reassembled), this.peerId);
  }

  private receiveChunk(chunk: ChunkEnvelope) {
    this.pruneOldChunks();
    if (chunk.total <= 0 || chunk.index < 0 || chunk.index >= chunk.total) return undefined;
    const current =
      this.receivedChunks.get(chunk.id) ?? {
        chunks: Array.from({ length: chunk.total }, () => ""),
        received: 0,
        total: chunk.total,
        createdAt: Date.now()
      };
    if (current.total !== chunk.total) {
      this.receivedChunks.delete(chunk.id);
      return undefined;
    }
    if (!current.chunks[chunk.index]) current.received += 1;
    current.chunks[chunk.index] = chunk.data;
    if (current.received < current.total) {
      this.receivedChunks.set(chunk.id, current);
      return undefined;
    }
    this.receivedChunks.delete(chunk.id);
    return current.chunks.join("");
  }

  private pruneOldChunks() {
    const cutoff = Date.now() - MAX_CHUNK_AGE_MS;
    this.receivedChunks.forEach((value, id) => {
      if (value.createdAt < cutoff) this.receivedChunks.delete(id);
    });
  }

  close() {
    this.channel?.close();
    this.connection.close();
    if (this.flushTimer !== undefined) window.clearTimeout(this.flushTimer);
    this.pendingMessages = [];
    this.receivedChunks.clear();
    this.onStatus(false, this.peerId);
  }
}
