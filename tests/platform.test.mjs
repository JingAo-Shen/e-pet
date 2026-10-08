import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { createPlatform } from "../server/platform.mjs";

async function start(dataFile) {
  const p = createPlatform({ dataFile });
  await new Promise((r) => p.server.listen(0, "127.0.0.1", r));
  return p;
}
async function client(platform, deviceId) {
  const socket = new WebSocket(
    `ws://127.0.0.1:${platform.server.address().port}/device`,
  );
  const queue = [],
    waiters = [];
  socket.on("message", (raw) => {
    const m = JSON.parse(raw);
    const i = waiters.findIndex((w) => w.type === m.type);
    if (i < 0) queue.push(m);
    else {
      const [w] = waiters.splice(i, 1);
      clearTimeout(w.timer);
      w.resolve(m);
    }
  });
  await new Promise((r, reject) => {
    socket.once("open", r);
    socket.once("error", reject);
  });
  const next = (type) => {
    const i = queue.findIndex((m) => m.type === type);
    if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = {
        type,
        resolve,
        timer: setTimeout(() => reject(new Error(`Timeout: ${type}`)), 2500),
      };
      waiters.push(w);
    });
  };
  const send = (type, payload = {}) =>
    socket.send(
      JSON.stringify({
        version: 1,
        id: crypto.randomUUID(),
        deviceId,
        type,
        payload,
      }),
    );
  send("device.hello");
  await next("device.ready");
  const initial = await next("memory.snapshot");
  return { socket, send, next, initial };
}

test("memory survives reconnect/restart, is isolated by device, and can be deleted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "e-pet-test-"));
  const dataFile = join(dir, "memory.json");
  let p;
  try {
    p = await start(dataFile);
    const a = await client(p, "dog-a"),
      b = await client(p, "dog-b");
    a.send("chat.text", { text: "我叫测试小林" });
    await a.next("command");
    const saved = await a.next("memory.snapshot");
    assert.equal(saved.payload.items[0].value, "测试小林");
    b.send("chat.text", { text: "你还记得我吗？" });
    assert.match((await b.next("command")).payload.text, /还没有/);
    await p.close();
    p = await start(dataFile);
    const again = await client(p, "dog-a");
    assert.equal(again.initial.payload.items[0].value, "测试小林");
    again.send("chat.text", { text: "你还记得我吗？" });
    assert.match((await again.next("command")).payload.text, /测试小林/);
    again.send("memory.delete", { id: again.initial.payload.items[0].id });
    assert.equal((await again.next("memory.snapshot")).payload.items.length, 0);
  } finally {
    if (p) await p.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("protocol rejects malformed input and oversized text; touch and photo return honest commands", async () => {
  const dir = mkdtempSync(join(tmpdir(), "e-pet-protocol-"));
  const p = await start(join(dir, "memory.json"));
  try {
    const c = await client(p, "dog-c");
    c.socket.send("{broken");
    assert.match((await c.next("error")).payload.message, /JSON/);
    c.send("chat.text", { text: "x".repeat(1001) });
    assert.match((await c.next("error")).payload.message, /1000/);
    c.send("sensor.touch", { zone: "head" });
    assert.equal((await c.next("command")).payload.action, "pet");
    c.send("sensor.photo", { width: 640, height: 480 });
    assert.match((await c.next("command")).payload.text, /没有进行图像识别/);
    c.send("device.action", { action: "invalid" });
    assert.match((await c.next("error")).payload.message, /不支持/);
    c.send("chat.text", { text: "晚安" });
    assert.equal((await c.next("command")).payload.action, "sleep");
  } finally {
    await p.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
