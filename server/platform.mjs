import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, extname, sep } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";

const actions = new Set([
  "bark",
  "pet",
  "feed",
  "play",
  "sit",
  "sleep",
  "wake",
  "wag",
]);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

export function createPlatform({
  dataFile = resolve("data/memories.json"),
  staticDir = resolve("dist"),
} = {}) {
  let database = {};
  if (existsSync(dataFile))
    database = JSON.parse(readFileSync(dataFile, "utf8"));
  function save() {
    mkdirSync(dirname(dataFile), { recursive: true });
    writeFileSync(dataFile, JSON.stringify(database, null, 2));
  }
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, mode: "demo" }));
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    const target = resolve(
      staticDir,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!target.startsWith(staticDir + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(target);
      res.setHeader(
        "Content-Type",
        mime[extname(target)] || "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404).end("Run npm run build first, or use npm run dev.");
    }
  });
  const wss = new WebSocketServer({
    server,
    path: "/device",
    maxPayload: 32 * 1024,
  });
  wss.on("connection", (socket) => {
    let deviceId;
    const send = (type, payload, requestId) =>
      socket.readyState === WebSocket.OPEN &&
      socket.send(
        JSON.stringify({
          version: 1,
          id: randomUUID(),
          type,
          deviceId,
          timestamp: new Date().toISOString(),
          requestId,
          payload,
        }),
      );
    const memories = () => database[deviceId] || [];
    const sync = () => send("memory.snapshot", { items: memories() });
    socket.on("message", (raw) => {
      let event;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        send("error", { message: "消息不是有效 JSON。" });
        return;
      }
      if (
        !event ||
        typeof event !== "object" ||
        event.version !== 1 ||
        typeof event.type !== "string"
      ) {
        send("error", { message: "不支持的协议。" });
        return;
      }
      const p = event.payload || {};
      if (event.type === "device.hello") {
        if (
          typeof event.deviceId !== "string" ||
          !/^[a-zA-Z0-9_-]{1,64}$/.test(event.deviceId) ||
          ["__proto__", "constructor", "prototype"].includes(event.deviceId)
        ) {
          send("error", { message: "设备编号无效。" });
          return;
        }
        deviceId = event.deviceId;
        send(
          "device.ready",
          {
            mode: "demo",
            message: "本地演示平台已连接",
            capabilities: [
              "chat.text",
              "touch",
              "action",
              "photo.metadata",
              "memory",
            ],
          },
          event.id,
        );
        sync();
        return;
      }
      if (!deviceId || event.deviceId !== deviceId) {
        send("error", { message: "请先注册设备。" }, event.id);
        return;
      }
      if (event.type === "memory.delete") {
        database[deviceId] = memories().filter((item) => item.id !== p.id);
        save();
        sync();
        return;
      }
      if (event.type === "memory.clear") {
        database[deviceId] = [];
        save();
        sync();
        return;
      }
      if (event.type === "chat.text") {
        if (
          typeof p.text !== "string" ||
          !p.text.trim() ||
          p.text.length > 1000
        ) {
          send("error", { message: "请输入 1–1000 字。" }, event.id);
          return;
        }
        const text = p.text.trim();
        const name = text.match(
          /(?:我叫|我的名字是)\s*([^，。！？!?\n]{1,20})/,
        );
        const like = text.match(
          /(?:我喜欢|我最喜欢)\s*([^，。！？!?\n]{1,40})/,
        );
        let reply,
          action = "wag";
        function remember(kind, value) {
          const record = {
            id: randomUUID(),
            kind,
            value: value.trim(),
            source: text,
            createdAt: new Date().toISOString(),
          };
          database[deviceId] = [
            ...memories().filter((item) => item.kind !== kind),
            record,
          ];
          save();
          sync();
        }
        if (name) {
          remember("name", name[1]);
          reply = `记住啦，你叫${name[1]}。我是豆包，以后也来找我玩吧！`;
        } else if (like) {
          remember("like", like[1]);
          reply = `原来你喜欢${like[1]}，我记住了！下次见面还可以聊这个。`;
        } else if (/记得|记住|叫什么|喜欢什么/.test(text)) {
          const n = memories().find((m) => m.kind === "name");
          const l = memories().find((m) => m.kind === "like");
          reply =
            n || l
              ? `${n ? `你叫${n.value}。` : ""}${l ? `你喜欢${l.value}。` : ""}这些是你亲口告诉我的。`
              : "我们还没有留下记忆。可以告诉我“我叫小林”或“我喜欢恐龙”。";
        } else if (/睡觉|休息|晚安/.test(text)) {
          reply = "那我先趴一会儿，晚安。想我了就叫醒我吧。";
          action = "sleep";
        } else if (/叫一|汪|叫声/.test(text)) {
          reply = "汪！汪汪！我在这里。";
          action = "bark";
        } else if (/坐下/.test(text)) {
          reply = "坐好啦！接下来玩什么？";
          action = "sit";
        } else if (/球|玩耍/.test(text)) {
          reply = "小球来啦！和你一起玩最开心了。";
          action = "play";
        } else if (/难过|不开心|伤心|累/.test(text))
          reply = "我在这里陪着你。我们可以安静待一会儿，也可以摸摸我的头。";
        else if (/你好|嗨|hello/i.test(text))
          reply = `你好${memories().find((m) => m.kind === "name")?.value || "呀"}！我是豆包，摸摸我的头试试看。`;
        else
          reply =
            "我现在使用本地规则演示，还不能理解所有问题。你可以让我坐下、叫一声，或告诉我“我喜欢恐龙”。接入智能平台后，我就能聊更多啦。";
        send("command", { action, text: reply, speak: true }, event.id);
        return;
      }
      if (event.type === "sensor.touch") {
        send(
          "command",
          { action: "pet", text: "嘿嘿，好舒服呀。再摸一下嘛！", speak: false },
          event.id,
        );
        return;
      }
      if (event.type === "sensor.photo") {
        send(
          "command",
          {
            text: "照片已经在终端拍好了。目前只向演示平台发送照片尺寸，没有上传照片内容，也没有进行图像识别。",
            speak: false,
          },
          event.id,
        );
        return;
      }
      if (event.type === "device.action" && actions.has(p.action)) {
        send("event.ack", { action: p.action }, event.id);
        return;
      }
      if (event.type === "device.telemetry") {
        send("event.ack", { received: true }, event.id);
        return;
      }
      send("error", { message: "不支持的事件类型或动作。" }, event.id);
    });
  });
  return {
    server,
    wss,
    close: async () => {
      for (const s of wss.clients) s.terminate();
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
    },
  };
}
