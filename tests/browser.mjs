import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  permissions: ["camera", "microphone"],
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  if (!localStorage.getItem("pet.deviceId"))
    localStorage.setItem("pet.deviceId", "browser-test");
  // Deterministic camera adapter: tests real MediaStream teardown without
  // relying on a physical camera or a host-specific fake-camera driver.
  navigator.mediaDevices.getUserMedia = async () => {
    if (window.denyTestCamera)
      throw new DOMException("Test denied", "NotAllowedError");
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      ctx.fillStyle = "#dbe5d1";
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = "#617c48";
      ctx.font = "28px sans-serif";
      ctx.fillText("Virtual camera / test frame", 60, 240);
    };
    draw();
    const media = canvas.captureStream(5),
      timer = setInterval(draw, 200);
    const track = media.getVideoTracks()[0],
      stop = track.stop.bind(track);
    track.stop = () => {
      clearInterval(timer);
      stop();
    };
    return media;
  };
});
try {
  await page.goto(process.env.APP_URL || "http://127.0.0.1:5173");
  await expect(page.getByText("平台已连接", { exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "关闭声音", exact: true }).click();
  await page.getByRole("button", { name: "摸摸头", exact: true }).click();
  await expect(page.locator(".pet-caption")).toHaveText("被摸头，开心中");
  await expect(
    page.getByText("嘿嘿，好舒服呀。再摸一下嘛！", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "休息", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "叫醒它", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "叫醒它", exact: true }).click();
  await page.getByRole("button", { name: "我叫小林", exact: true }).click();
  await expect(
    page.getByText("记住啦，你叫小林。我是豆包，以后也来找我玩吧！", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "我喜欢恐龙", exact: true }).click();
  await page.getByRole("tab", { name: /它的记忆/ }).click();
  await expect(page.locator(".memory-item")).toHaveCount(2);
  await page.reload();
  await expect(page.getByText("平台已连接", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /它的记忆/ }).click();
  await expect(page.locator(".memory-item")).toHaveCount(2);
  await page
    .getByRole("button", { name: "删除记忆：恐龙", exact: true })
    .click();
  await expect(page.locator(".memory-item")).toHaveCount(1);
  await page.getByRole("button", { name: "清空演示记忆", exact: true }).click();
  await expect(page.locator(".memory-item")).toHaveCount(0);
  await page.getByRole("tab", { name: "聊聊天", exact: true }).click();
  await page.getByRole("button", { name: "断开", exact: true }).click();
  await expect(page.getByText("已手动断开", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "玩小球", exact: true }).click();
  await expect(page.locator(".pet-caption")).toHaveText("接住小球啦");
  await expect(
    page.getByRole("button", { name: "我叫小林", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "连接", exact: true }).click();
  await expect(page.getByText("平台已连接", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /借豆包的眼睛/ }).click();
  await page.getByRole("button", { name: "开启摄像头", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
  await page.waitForFunction(
    () => document.querySelector("video")?.videoWidth > 0,
  );
  await page.evaluate(() => {
    window.testTrack = document
      .querySelector("video")
      .srcObject.getVideoTracks()[0];
  });
  await page.getByRole("button", { name: "拍一张", exact: true }).click();
  await expect(page.getByAltText("刚刚拍摄或上传的照片")).toBeVisible();
  expect(await page.evaluate(() => window.testTrack.readyState)).toBe("ended");
  await page.screenshot({ path: "test-results/camera.png" });
  await page
    .locator("input[type=file]")
    .setInputFiles("test-results/camera.png");
  await expect(page.locator(".camera-modal .form-hint")).toContainText("960");
  await page.getByRole("button", { name: "删除照片", exact: true }).click();
  await expect(page.getByAltText("刚刚拍摄或上传的照片")).toHaveCount(0);
  await page.getByRole("button", { name: "开启摄像头", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("video")?.srcObject?.active,
  );
  await page.evaluate(() => {
    window.testTrack = document
      .querySelector("video")
      .srcObject.getVideoTracks()[0];
  });
  await page.getByRole("button", { name: "关闭窗口", exact: true }).click();
  expect(await page.evaluate(() => window.testTrack.readyState)).toBe("ended");
  await page.evaluate(() => {
    window.denyTestCamera = true;
  });
  await page.getByRole("button", { name: /借豆包的眼睛/ }).click();
  await page.getByRole("button", { name: "开启摄像头", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("权限被拒绝");
  await page.getByRole("button", { name: "关闭窗口", exact: true }).click();
  await page.getByRole("button", { name: "关闭电源", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "摸摸头", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "打开电源", exact: true }).click();
  await expect(page.getByText("平台已连接", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "设备事件", exact: true }).click();
  await expect(page.locator(".event-item").first()).toBeVisible();
  await page.getByRole("tab", { name: "聊聊天", exact: true }).click();
  await page.getByRole("button", { name: "可可色", exact: true }).click();
  await page.getByRole("button", { name: "蜂蜜色", exact: true }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "设备设置", exact: true }).click();
  await page
    .getByLabel("平台地址", { exact: true })
    .fill("https://invalid.example");
  await page.getByRole("button", { name: "保存并连接", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("ws://");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "PASS: 3D render, actions, chat, persistent memory, deletion, disconnect/reconnect, camera capture and stream cleanup, power cycle, events, settings validation, mobile layout. No browser runtime errors.",
  );
} finally {
  await context.close();
  await browser.close();
}
