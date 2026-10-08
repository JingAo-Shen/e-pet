import { useEffect, useRef, useState } from "react";

export const capabilities = [
  "audio.output",
  "speech.input.browser",
  "camera.browser",
  "touch.head",
  "motion.tail",
  "motion.pose",
];
export function envelope(type, payload, deviceId) {
  return {
    version: 1,
    id: crypto.randomUUID(),
    deviceId,
    timestamp: new Date().toISOString(),
    type,
    payload,
  };
}

export function useDevice({ endpoint, deviceId, enabled, onMessage }) {
  const socket = useRef(null),
    callback = useRef(onMessage);
  callback.current = onMessage;
  const [status, setStatus] = useState("offline"),
    [events, setEvents] = useState([]);
  const record = (direction, message) =>
    setEvents((items) => [{ direction, ...message }, ...items].slice(0, 80));
  useEffect(() => {
    if (!enabled) {
      setStatus("offline");
      return;
    }
    let cancelled = false,
      timer,
      ws,
      retry = 0;
    function connect() {
      setStatus("connecting");
      try {
        ws = new WebSocket(endpoint);
        socket.current = ws;
      } catch {
        setStatus("offline");
        return;
      }
      ws.onopen = () => {
        const hello = envelope(
          "device.hello",
          { name: "豆包", model: "dog-simulator-v1", capabilities },
          deviceId,
        );
        ws.send(JSON.stringify(hello));
        record("up", hello);
      };
      ws.onmessage = (e) => {
        if (cancelled) return;
        try {
          const message = JSON.parse(e.data);
          if (
            !message ||
            typeof message.type !== "string" ||
            !message.payload ||
            typeof message.payload !== "object"
          )
            return;
          if (message.type === "device.ready") {
            setStatus("online");
            retry = 0;
          }
          record("down", message);
          callback.current(message);
        } catch {
          /* A malformed remote packet must not crash the terminal. */
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (cancelled) return;
        setStatus("offline");
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 10000));
      };
    }
    connect();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ws?.close();
      socket.current = null;
    };
  }, [endpoint, deviceId, enabled]);
  const send = (type, payload) => {
    if (status !== "online" || socket.current?.readyState !== WebSocket.OPEN)
      return false;
    const packet = envelope(type, payload, deviceId);
    socket.current.send(JSON.stringify(packet));
    record("up", packet);
    return packet.id;
  };
  return { status, events, send, clearEvents: () => setEvents([]) };
}

let audioContext;
export function bark() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audioContext ||= new Audio();
  audioContext.resume();
  for (let i = 0; i < 2; i++) {
    const time = audioContext.currentTime + i * 0.28;
    const oscillator = audioContext.createOscillator(),
      gain = audioContext.createGain(),
      filter = audioContext.createBiquadFilter();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(260, time);
    oscillator.frequency.exponentialRampToValueAtTime(95, time + 0.16);
    filter.type = "lowpass";
    filter.frequency.value = 950;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.16, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.2);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}
