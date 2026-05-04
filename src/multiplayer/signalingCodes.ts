import type { SignalCode } from "./multiplayerTypes";

export const encodeSignalCode = (code: SignalCode) => btoa(unescape(encodeURIComponent(JSON.stringify(code))));

export const decodeSignalCode = (input: string): SignalCode => {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(input.trim())))) as SignalCode;
    if ((parsed.type !== "offer" && parsed.type !== "answer") || !parsed.sdp) {
      throw new Error("Invalid code shape.");
    }
    return parsed;
  } catch {
    throw new Error("Invalid offer or answer code.");
  }
};
