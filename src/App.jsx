import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  PawPrint,
  AudioLines,
  Camera,
  Heart,
  Moon,
  Sun,
  Hand,
  CircleHelp,
  Settings2,
  Radio,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Send,
  Mic,
  Square,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Check,
  Trash2,
  Upload,
  Plug,
  Battery,
  Circle,
  Cookie,
  CircleDot,
  Power,
  Maximize2,
  BookOpen,
} from "lucide-react";
import { bark, useDevice } from "./device.js";
const PetScene = lazy(() => import("./PetScene.jsx"));

const labels = {
  idle: "在等你一起玩",
  pet: "被摸头，开心中",
  bark: "汪！汪汪！",
  feed: "好吃，谢谢你",
  play: "接住小球啦",
  sit: "乖乖坐好了",
  sleep: "嘘，休息一会儿",
  wake: "我醒啦，继续玩吧",
  wag: "见到你真开心",
};
const actions = [
  ["pet", Hand, "摸摸头"],
  ["bark", AudioLines, "叫一声"],
  ["feed", Cookie, "喂零食"],
  ["play", CircleDot, "玩小球"],
  ["sit", PawPrint, "坐下"],
  ["sleep", Moon, "休息"],
];
const presets = ["你好，豆包", "我叫小林", "我喜欢恐龙", "你还记得我吗？"];
function stored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function persist(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* App works without local storage. */
  }
}
const defaultEndpoint = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/device`;

export default function App() {
  const [powered, setPowered] = useState(true),
    [connected, setConnected] = useState(true);
  const [endpoint, setEndpoint] = useState(() =>
    stored("pet.endpoint", defaultEndpoint),
  );
  const [deviceId, setDeviceId] = useState(() =>
    stored("pet.deviceId", `dog-${crypto.randomUUID().slice(0, 8)}`),
  );
  const [coat, setCoat] = useState("honey"),
    [action, setAction] = useState({ type: "idle", id: 0 });
  const [tab, setTab] = useState("chat"),
    [volume, setVolume] = useState(true),
    [resetView, setResetView] = useState(0);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "pet",
      text: "你好呀，我是豆包！摸摸我的头，或者和我说句话吧。",
    },
  ]);
  const [draft, setDraft] = useState(""),
    [memories, setMemories] = useState([]),
    [pending, setPending] = useState(false);
  const [toast, setToast] = useState(""),
    [dialog, setDialog] = useState(null),
    [listening, setListening] = useState(false);
  const [battery, setBattery] = useState(86),
    [photo, setPhoto] = useState(null),
    [cameraActive, setCameraActive] = useState(false),
    [cameraBusy, setCameraBusy] = useState(false),
    [cameraError, setCameraError] = useState("");
  const [settings, setSettings] = useState({ endpoint, deviceId });
  const stream = useRef(null),
    cameraRequest = useRef(0),
    video = useRef(null),
    recognizer = useRef(null),
    scroll = useRef(null),
    actionTimer = useRef(null),
    replyTimer = useRef(null);
  const activeRequest = useRef(null),
    sound = useRef(volume);
  sound.current = volume;
  const addMessage = (role, text) =>
    setMessages((items) =>
      [...items, { id: crypto.randomUUID(), role, text }].slice(-100),
    );
  const notify = (text) => setToast(text);
  const animate = (type) => {
    clearTimeout(actionTimer.current);
    setAction({ type, id: Date.now() });
    if (type === "bark" && sound.current) bark();
    if (!["sleep", "sit"].includes(type))
      actionTimer.current = setTimeout(
        () => setAction({ type: "idle", id: Date.now() }),
        3800,
      );
  };
  const speak = (text) => {
    if (!sound.current || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.08;
    utterance.pitch = 1.2;
    window.speechSynthesis.speak(utterance);
  };
  const device = useDevice({
    endpoint,
    deviceId,
    enabled: connected && powered,
    onMessage: (event) => {
      if (event.type === "command") {
        if (event.requestId === activeRequest.current) {
          setPending(false);
          clearTimeout(replyTimer.current);
          activeRequest.current = null;
        }
        if (typeof event.payload.text === "string") {
          addMessage("pet", event.payload.text);
          if (event.payload.speak) speak(event.payload.text);
        }
        if (labels[event.payload.action]) animate(event.payload.action);
      }
      if (
        event.type === "memory.snapshot" &&
        Array.isArray(event.payload.items)
      )
        setMemories(
          event.payload.items.filter(
            (m) => m && typeof m.id === "string" && typeof m.value === "string",
          ),
        );
      if (event.type === "error") {
        notify(event.payload.message || "平台返回错误");
        setPending(false);
        clearTimeout(replyTimer.current);
      }
    },
  });
  const online = powered && connected && device.status === "online";
  const asleep = action.type === "sleep";
  useEffect(() => {
    persist("pet.deviceId", deviceId);
  }, [deviceId]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, pending, tab]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!online) {
      setPending(false);
      clearTimeout(replyTimer.current);
      activeRequest.current = null;
    }
  }, [online]);
  useEffect(
    () => () => {
      clearTimeout(actionTimer.current);
      clearTimeout(replyTimer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      recognizer.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  useEffect(() => {
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const trap = (e) => {
      if (e.key === "Escape") {
        closeDialog();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = [
        ...document.querySelectorAll(
          ".modal button:not(:disabled), .modal input:not([type=file]), .modal a[href]",
        ),
      ].filter((n) => n.offsetParent !== null);
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previousFocus?.focus();
    };
  }, [dialog]);
  function doAction(type) {
    if (!powered) {
      notify("请先打开宠物电源。");
      return;
    }
    animate(type);
    if (type === "pet")
      device.send("sensor.touch", { zone: "head", pressure: 0.6 });
    else device.send("device.action", { action: type });
  }
  function sendChat(text = draft) {
    const clean = text.trim();
    if (!clean || pending) return;
    if (!online) {
      notify("平台尚未连接。可以先使用小狗的本地动作。");
      return;
    }
    const id = device.send("chat.text", { text: clean });
    if (!id) return;
    addMessage("user", clean);
    setDraft("");
    setPending(true);
    activeRequest.current = id;
    replyTimer.current = setTimeout(() => {
      setPending(false);
      activeRequest.current = null;
      notify("平台回复超时，请检查连接后重试。");
    }, 12000);
  }
  function toggleVoice() {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      notify("此浏览器不支持语音转文字，请使用文字输入。");
      return;
    }
    const r = new Recognition();
    recognizer.current = r;
    r.lang = "zh-CN";
    r.interimResults = false;
    r.continuous = false;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onresult = (e) => {
      setDraft(e.results[0][0].transcript.slice(0, 1000));
      notify("已转成文字，确认后点击发送。");
    };
    r.onerror = (e) => {
      setListening(false);
      notify(
        e.error === "not-allowed"
          ? "麦克风权限未开启，可以继续打字。"
          : "语音识别不可用，请重试或使用文字输入。",
      );
    };
    try {
      r.start();
    } catch {
      notify("无法启动语音识别。");
    }
  }
  function stopCamera() {
    cameraRequest.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCameraActive(false);
    setCameraBusy(false);
  }
  function closeDialog() {
    stopCamera();
    setDialog(null);
  }
  async function openCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("当前环境不支持摄像头，请上传一张图片。");
      return;
    }
    stopCamera();
    const request = ++cameraRequest.current;
    setCameraBusy(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      if (request !== cameraRequest.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setPhoto(null);
      setCameraActive(true);
      setCameraBusy(false);
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
    } catch (e) {
      if (request !== cameraRequest.current) return;
      stopCamera();
      setCameraError(
        e.name === "NotAllowedError"
          ? "摄像头权限被拒绝。你也可以上传照片。"
          : "无法打开摄像头，请检查设备或上传照片。",
      );
    }
  }
  function savePhoto(source, w, h) {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 960 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas
      .getContext("2d")
      .drawImage(source, 0, 0, canvas.width, canvas.height);
    setPhoto({
      url: canvas.toDataURL("image/jpeg", 0.88),
      width: canvas.width,
      height: canvas.height,
    });
    device.send("sensor.photo", {
      width: canvas.width,
      height: canvas.height,
      contentTransferred: false,
    });
    stopCamera();
    setCameraError("");
  }
  function capture() {
    if (!video.current?.videoWidth) {
      setCameraError("摄像头尚未准备好，请稍后再试。");
      return;
    }
    savePhoto(
      video.current,
      video.current.videoWidth,
      video.current.videoHeight,
    );
  }
  function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setCameraError("请选取小于 10 MB 的图片。");
      return;
    }
    stopCamera();
    const request = cameraRequest.current;
    const url = URL.createObjectURL(file),
      img = new Image();
    img.onload = () => {
      if (request === cameraRequest.current)
        savePhoto(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setCameraError("无法读取这张图片，请使用 JPG 或 PNG。");
    };
    img.src = url;
  }
  function togglePower() {
    if (powered) {
      stopCamera();
      recognizer.current?.abort();
      window.speechSynthesis?.cancel();
      clearTimeout(actionTimer.current);
    } else animate("wake");
    setPowered(!powered);
  }
  function applySettings(e) {
    e.preventDefault();
    let url;
    try {
      url = new URL(settings.endpoint);
    } catch {
      notify("请输入有效的 WebSocket 地址。");
      return;
    }
    if (
      !["ws:", "wss:"].includes(url.protocol) ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(settings.deviceId) ||
      ["__proto__", "constructor", "prototype"].includes(settings.deviceId)
    ) {
      notify(
        "地址需以 ws:// 或 wss:// 开头；设备编号只能包含英文、数字、短横线和下划线。",
      );
      return;
    }
    setMemories([]);
    setEndpoint(url.href);
    setDeviceId(settings.deviceId);
    persist("pet.endpoint", url.href);
    persist("pet.deviceId", settings.deviceId);
    setConnected(true);
    closeDialog();
    notify("连接配置已保存。");
  }
  function showSettings() {
    setSettings({ endpoint, deviceId });
    setDialog("settings");
  }
  function toggleSound() {
    if (volume) window.speechSynthesis?.cancel();
    setVolume(!volume);
  }

  return (
    <div className="app-shell">
      <aside className="rail">
        <a className="brand-mark" href="#" aria-label="伴伴首页">
          <PawPrint size={25} />
        </a>
        <div className="rail-line" />
        <button
          className="rail-button selected"
          title="宠物模拟器"
          aria-label="宠物模拟器"
          onClick={() => setTab("chat")}
        >
          <PawPrint size={21} />
          <span>宠物</span>
        </button>
        <button
          className="rail-button"
          onClick={() => setTab("events")}
          title="设备事件"
        >
          <Radio size={21} />
          <span>设备</span>
        </button>
        <button
          className="rail-button"
          onClick={() => setTab("memory")}
          title="演示记忆"
        >
          <BookOpen size={21} />
          <span>记忆</span>
        </button>
        <div className="rail-bottom">
          <button
            className="rail-button"
            onClick={() => setDialog("help")}
            aria-label="使用说明"
          >
            <CircleHelp size={21} />
          </button>
          <div className="avatar">研</div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="wordmark">
            伴伴<span> / </span>
            <span className="topbar-subtitle">宠物模拟实验室</span>
          </div>
          <div className="topbar-right">
            <span className="demo-label">
              <span />
              本地演示
            </span>
            <button className="text-button" onClick={() => setDialog("help")}>
              使用指南 <ArrowUpRight size={15} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">PET SIMULATOR / 001</div>
              <h1>
                你好，这是豆包<span className="heading-dot">。</span>
              </h1>
              <p>从一次摸头开始，遇见你的智能小伙伴。</p>
            </div>
            <button
              className="outline-button device-settings"
              onClick={showSettings}
            >
              <Settings2 size={16} />
              设备设置
            </button>
          </div>
          <div className="main-grid">
            <section className="pet-section" aria-label="宠物互动区">
              <div className="pet-stage">
                <Suspense
                  fallback={
                    <div className="scene-error">豆包正在来到你身边…</div>
                  }
                >
                  <PetScene
                    action={action}
                    powered={powered}
                    coat={coat}
                    onTouch={() => doAction("pet")}
                    resetView={resetView}
                  />
                </Suspense>
                <div className="stage-top">
                  <span className={`status-pill ${online ? "online" : ""}`}>
                    <i />
                    {!powered
                      ? "已关机"
                      : online
                        ? "设备在线"
                        : device.status === "connecting" && connected
                          ? "连接中"
                          : "离线模式"}
                  </span>
                  <span className="stage-model">陪伴小狗 · 虚拟终端</span>
                </div>
                <div className="stage-tools">
                  <button
                    className="round-button"
                    onClick={toggleSound}
                    aria-label={volume ? "关闭声音" : "打开声音"}
                    title={volume ? "关闭声音" : "打开声音"}
                  >
                    {volume ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                  <button
                    className="round-button"
                    onClick={() => setResetView((x) => x + 1)}
                    aria-label="重置视角"
                    title="重置视角"
                  >
                    <RotateCcw size={17} />
                  </button>
                  <button
                    className={`round-button ${!powered ? "power-off" : ""}`}
                    onClick={togglePower}
                    aria-label={powered ? "关闭电源" : "打开电源"}
                    title={powered ? "关闭电源" : "打开电源"}
                  >
                    <Power size={17} />
                  </button>
                </div>
                <div className="pet-caption" aria-live="polite">
                  <span className="caption-dot" />
                  {!powered ? "电源已关闭" : labels[action.type]}
                </div>
                <div className="stage-bottom">
                  <span>
                    <Maximize2 size={13} />
                    拖动旋转 · 滚轮缩放
                  </span>
                  <div className="coat-picker" aria-label="选择毛色">
                    {[
                      ["honey", "蜂蜜色"],
                      ["cream", "奶油色"],
                      ["cocoa", "可可色"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={`coat ${value} ${coat === value ? "active" : ""}`}
                        onClick={() => setCoat(value)}
                        aria-label={label}
                        title={label}
                      >
                        {coat === value && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
                {!powered && <div className="sleep-label">zzz</div>}
              </div>
              <div className="pet-info">
                <div>
                  <span className="pet-name">豆包</span>
                  <span className="pet-breed">金毛小狗</span>
                </div>
                <div className="pet-state">
                  <Heart size={14} />
                  {!powered ? "休眠中" : asleep ? "安心休息" : "想和你玩"}
                  <span className="separator" />
                  <Battery size={16} />
                  {battery}%<small>模拟</small>
                </div>
              </div>
              <div className="action-grid">
                {actions.map(([type, Icon, label]) => (
                  <button
                    key={type}
                    disabled={!powered}
                    className={`action-button ${action.type === type ? "active" : ""}`}
                    onClick={() =>
                      doAction(type === "sleep" && asleep ? "wake" : type)
                    }
                  >
                    <Icon size={23} strokeWidth={1.65} />
                    <span>{type === "sleep" && asleep ? "叫醒它" : label}</span>
                  </button>
                ))}
              </div>
              <button
                className="camera-strip"
                disabled={!powered}
                onClick={() => {
                  setCameraError("");
                  setDialog("camera");
                }}
              >
                <span className="camera-strip-icon">
                  <Camera size={21} />
                </span>
                <span>
                  <strong>借豆包的眼睛，看看世界</strong>
                  <small>
                    {photo
                      ? "已拍摄 1 张照片 · 点击查看"
                      : "打开摄像头，或上传一张照片"}
                  </small>
                </span>
                <ChevronRight size={19} />
              </button>
            </section>
            <section className="companion-panel" aria-label="平台互动面板">
              <div className="panel-tabs" role="tablist">
                {[
                  ["chat", "聊聊天"],
                  ["memory", "它的记忆"],
                  ["events", "设备事件"],
                ].map(([key, label]) => (
                  <button
                    role="tab"
                    aria-selected={tab === key}
                    className={tab === key ? "active" : ""}
                    onClick={() => setTab(key)}
                    key={key}
                  >
                    {label}
                    {key === "memory" && memories.length > 0 && (
                      <span className="count">{memories.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {tab === "chat" && (
                <div className="chat-panel">
                  <div className="panel-note">
                    <span className="tiny-dot" />
                    规则对话演示<span className="note-divider">·</span>
                    尚未接入大模型
                  </div>
                  <div
                    className="chat-messages"
                    ref={scroll}
                    role="log"
                    aria-live="polite"
                  >
                    <div className="chat-date">今天 · 和豆包的相处时光</div>
                    {messages.map((m) => (
                      <div className={`message ${m.role}`} key={m.id}>
                        {m.role === "pet" && (
                          <div className="message-avatar">
                            <PawPrint size={17} />
                          </div>
                        )}
                        <div>
                          <span className="message-name">
                            {m.role === "pet" ? "豆包" : "你"}
                          </span>
                          <div className="bubble">{m.text}</div>
                        </div>
                      </div>
                    ))}
                    {pending && (
                      <div className="typing">
                        豆包正在等平台回复<span>...</span>
                      </div>
                    )}
                  </div>
                  <div className="chat-compose">
                    <div className="suggestions">
                      {presets.map((text) => (
                        <button
                          disabled={!online || pending}
                          key={text}
                          onClick={() => sendChat(text)}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendChat();
                      }}
                    >
                      <label className="sr-only" htmlFor="chat-input">
                        给豆包发消息
                      </label>
                      <textarea
                        id="chat-input"
                        rows="2"
                        maxLength={1000}
                        placeholder={
                          online
                            ? "和豆包说点什么…"
                            : "连接平台后，就可以聊天了…"
                        }
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            sendChat();
                          }
                        }}
                      />
                      <div className="input-toolbar">
                        <button
                          type="button"
                          className={`mic-button ${listening ? "listening" : ""}`}
                          disabled={!powered}
                          onClick={toggleVoice}
                          aria-label={listening ? "停止录音" : "语音输入"}
                        >
                          {listening ? <Square size={15} /> : <Mic size={17} />}
                          <span>
                            {listening ? "正在聆听，点此停止" : "语音输入"}
                          </span>
                        </button>
                        <button
                          className="send-button"
                          type="submit"
                          disabled={!online || !draft.trim() || pending}
                          aria-label="发送消息"
                        >
                          <Send size={17} />
                        </button>
                      </div>
                    </form>
                    <p className="input-hint">
                      Enter 发送 · Shift + Enter 换行
                    </p>
                  </div>
                </div>
              )}
              {tab === "memory" && (
                <div className="detail-panel">
                  <div className="detail-heading">
                    <h2>一点点，记住你</h2>
                    <BookOpen size={21} />
                  </div>
                  <p className="detail-description">
                    演示记忆保存在本机服务中，按设备编号区分。重新连接后仍可读取。
                  </p>
                  {memories.length ? (
                    <div className="memory-list">
                      {memories.map((m) => (
                        <article className="memory-item" key={m.id}>
                          <div className="memory-category">
                            {m.kind === "name" ? "你的名字" : "你喜欢的事物"}
                            <button
                              aria-label={`删除记忆：${m.value}`}
                              disabled={!online}
                              onClick={() =>
                                device.send("memory.delete", { id: m.id })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <strong>{m.value}</strong>
                          <p>来自你的话：“{m.source}”</p>
                          <time>
                            {new Date(m.createdAt).toLocaleString("zh-CN")}
                          </time>
                        </article>
                      ))}
                      <button
                        className="text-button danger"
                        disabled={!online}
                        onClick={() => device.send("memory.clear", {})}
                      >
                        <Trash2 size={14} />
                        清空演示记忆
                      </button>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <BookOpen size={34} strokeWidth={1.3} />
                      <h3>我们的故事，刚刚开始</h3>
                      <p>
                        在聊天中说“我叫小林”
                        <br />
                        或“我喜欢恐龙”，留下第一条记忆。
                      </p>
                      <button
                        className="outline-button"
                        onClick={() => setTab("chat")}
                      >
                        去聊聊天
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                  <div className="bottom-note">
                    这是记忆接口演示；完整的用户账户与长期记忆服务将由后续平台提供。
                  </div>
                </div>
              )}
              {tab === "events" && (
                <div className="detail-panel events-panel">
                  <div className="detail-heading">
                    <h2>终端与平台之间</h2>
                    <button
                      className="icon-button"
                      aria-label="清空事件日志"
                      onClick={device.clearEvents}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="detail-description">
                    上行是感知事件，下行是平台指令。最近 80
                    条，仅保留在当前页面。
                  </p>
                  <div className="event-list">
                    {device.events.length ? (
                      device.events.map((event, i) => (
                        <details
                          key={`${event.id}-${i}`}
                          className="event-item"
                        >
                          <summary>
                            <span
                              className={`event-direction ${event.direction}`}
                            >
                              {event.direction === "up" ? (
                                <ArrowUpRight size={14} />
                              ) : (
                                <ArrowDownLeft size={14} />
                              )}
                            </span>
                            <span>{event.type}</span>
                            <time>
                              {new Date(event.timestamp).toLocaleTimeString(
                                "zh-CN",
                                { hour12: false },
                              )}
                            </time>
                          </summary>
                          <pre>{JSON.stringify(event, null, 2)}</pre>
                        </details>
                      ))
                    ) : (
                      <div className="empty-state">
                        <Radio size={30} />
                        <p>操作小狗后，这里会出现设备事件。</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="connection-bar">
                <span className={online ? "connected" : ""}>
                  {online ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
                  {online
                    ? "平台已连接"
                    : !connected
                      ? "已手动断开"
                      : !powered
                        ? "设备已关机"
                        : "等待平台连接"}
                </span>
                <button
                  disabled={!powered}
                  onClick={() => setConnected(!connected)}
                >
                  {connected ? "断开" : "连接"}
                  <Plug size={13} />
                </button>
              </div>
            </section>
          </div>
          <footer className="page-footer">
            <span>
              <Circle size={7} fill="currentColor" />
              轻终端 · 重平台 · 无限可能
            </span>
            <span>
              虚拟设备 {deviceId} <span className="footer-separator">/</span>{" "}
              Simulator v0.1
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button onClick={() => setToast("")} aria-label="关闭提示">
            <X size={15} />
          </button>
        </div>
      )}
      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            className={`modal ${dialog === "camera" ? "camera-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") closeDialog();
            }}
          >
            <button
              autoFocus
              className="modal-close icon-button"
              onClick={closeDialog}
              aria-label="关闭窗口"
            >
              <X size={21} />
            </button>
            {dialog === "settings" && (
              <>
                <div className="eyebrow">DEVICE CONFIGURATION</div>
                <h2 id="dialog-title">让豆包连接你的平台</h2>
                <p className="detail-description">
                  默认连接随项目启动的本地演示服务。也可以换成兼容设备协议的
                  WebSocket 服务。
                </p>
                <form className="settings-form" onSubmit={applySettings}>
                  <label>
                    平台地址
                    <input
                      value={settings.endpoint}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, endpoint: e.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    设备编号
                    <input
                      value={settings.deviceId}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, deviceId: e.target.value }))
                      }
                      maxLength={64}
                      required
                    />
                  </label>
                  <label>
                    模拟电量 <span>{battery}%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={battery}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setBattery(value);
                        device.send("device.telemetry", {
                          battery: value,
                          simulated: true,
                        });
                      }}
                    />
                  </label>
                  <p className="form-hint">
                    电量仅用于模拟遥测，不会真实消耗或自动关机。
                  </p>
                  <button className="primary-button" type="submit">
                    保存并连接
                    <Plug size={16} />
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({ ...s, endpoint: defaultEndpoint }))
                    }
                  >
                    恢复本地平台地址
                  </button>
                </form>
              </>
            )}
            {dialog === "camera" && (
              <>
                <div className="eyebrow">THROUGH DOUBAO’S EYES</div>
                <h2 id="dialog-title">豆包看见的世界</h2>
                <p className="detail-description">
                  照片仅在当前页面预览，关闭页面后消失。演示平台只接收尺寸信息，不识别图片内容。
                </p>
                <div className="camera-preview">
                  <video ref={video} hidden={!cameraActive} playsInline muted />
                  {photo && !cameraActive && (
                    <img src={photo.url} alt="刚刚拍摄或上传的照片" />
                  )}
                  {!photo && !cameraActive && (
                    <div className="camera-empty">
                      <Camera size={42} strokeWidth={1.2} />
                      <p>
                        {cameraBusy
                          ? "正在请求摄像头权限…"
                          : "让它看见你眼前的美好"}
                      </p>
                      <span>开启摄像头需要你的浏览器授权</span>
                    </div>
                  )}
                </div>
                {cameraError && (
                  <p className="form-error" role="alert">
                    {cameraError}
                  </p>
                )}
                <div className="camera-actions">
                  {cameraActive ? (
                    <>
                      <button className="primary-button" onClick={capture}>
                        <Camera size={17} />
                        拍一张
                      </button>
                      <button className="outline-button" onClick={stopCamera}>
                        关闭摄像头
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={openCamera}
                      disabled={cameraBusy}
                    >
                      <Camera size={17} />
                      {photo ? "重新拍摄" : "开启摄像头"}
                    </button>
                  )}
                  <label className="outline-button upload-button">
                    <Upload size={16} />
                    上传照片
                    <input type="file" accept="image/*" onChange={upload} />
                  </label>
                  {photo && (
                    <button
                      className="icon-button"
                      aria-label="删除照片"
                      onClick={() => setPhoto(null)}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                {photo && (
                  <p className="form-hint">
                    {photo.width} × {photo.height} · 仅在本页保存
                  </p>
                )}
              </>
            )}
            {dialog === "help" && (
              <>
                <div className="eyebrow">A SMALL COMPANION, A BIG IDEA</div>
                <h2 id="dialog-title">从一只小狗，开始探索</h2>
                <div className="help-steps">
                  <p>
                    <b>01</b>
                    <span>
                      <strong>先和它打个招呼</strong>
                      点击三维小狗或下方按钮，体验摸头、合成叫声、玩球和休息。拖动可观察不同角度。
                    </span>
                  </p>
                  <p>
                    <b>02</b>
                    <span>
                      <strong>让平台参与互动</strong>
                      聊天采用本地规则演示。“我叫…”“我喜欢…”会生成可删除的演示记忆。没有接入通用
                      AI 或图像识别。
                    </span>
                  </p>
                  <p>
                    <b>03</b>
                    <span>
                      <strong>模拟真实的感知</strong>
                      摄像头会请求授权；照片只在本页预览。语音转文字由浏览器提供，可能使用浏览器厂商的在线服务；失败时可以打字。
                    </span>
                  </p>
                  <p>
                    <b>04</b>
                    <span>
                      <strong>观察每一次通信</strong>
                      “设备事件”可查看消息，“设备设置”可切换平台地址。断开连接后，小狗的本地动作仍然可用。
                    </span>
                  </p>
                </div>
                <button className="primary-button" onClick={closeDialog}>
                  开始和豆包玩
                  <ArrowUpRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
