# 玩具设备协议 v1

传输：UTF-8 JSON / WebSocket。演示服务端点：`ws://127.0.0.1:8787/device`。连接后先发送 `device.hello`，收到 `device.ready` 才进入在线状态。断线时终端指数退避重试，最多间隔 10 秒；离线不排队聊天和事件，避免重放真实动作。

## 消息信封

```json
{
  "version": 1,
  "id": "唯一消息 ID",
  "deviceId": "dog-demo-001",
  "timestamp": "2026-10-08T08:00:00.000Z",
  "type": "sensor.touch",
  "payload": { "zone": "head", "pressure": 0.6 }
}
```

服务端响应可包含 `requestId`，对应发起消息的 `id`。设备编号仅允许 1–64 位英文、数字、短横线、下划线，不能当作鉴权凭据。消息上限 32 KB，文字上限 1000 字。

## 上行事件

| type               | payload                                      | 用途                                               |
| ------------------ | -------------------------------------------- | -------------------------------------------------- |
| `device.hello`     | `{name, model, capabilities: []}`            | 注册终端及能力声明                                 |
| `chat.text`        | `{text}`                                     | 用户确认发送的文字或语音转写                       |
| `sensor.touch`     | `{zone: "head", pressure: 0.6}`              | 摸头感知                                           |
| `device.action`    | `{action}`                                   | 用户已在本地执行动作的通知，不应再重复下发相同动作 |
| `sensor.photo`     | `{width, height, contentTransferred: false}` | 拍照完成，只传元数据                               |
| `device.telemetry` | `{battery: 86, simulated: true}`             | 模拟电量                                           |
| `memory.delete`    | `{id}`                                       | 管理面板删除一条演示记忆                           |
| `memory.clear`     | `{}`                                         | 管理面板清空当前设备演示记忆                       |

终端声明能力：`audio.output`、`speech.input.browser`、`camera.browser`、`touch.head`、`motion.tail`、`motion.pose`。目前演示服务面向小狗，不根据不同能力进行复杂任务规划。记忆管理事件是教学管理功能，未来应由认证后的管理 API 承担。

## 下行消息

| type              | payload                                           | 用途                         |
| ----------------- | ------------------------------------------------- | ---------------------------- |
| `device.ready`    | `{mode: "demo", message, capabilities}`           | 平台接受连接                 |
| `command`         | `{action?, text?, speak?}`                        | 动作、聊天内容及是否语音播放 |
| `memory.snapshot` | `{items: [{id, kind, value, source, createdAt}]}` | 初次连接及记忆变更后同步     |
| `event.ack`       | `{action?}` / `{received: true}`                  | 收到本地动作或遥测           |
| `error`           | `{message}`                                       | 协议或输入错误               |

动作：`bark`、`pet`、`feed`、`play`、`sit`、`sleep`、`wake`、`wag`。短动作持续约 3.8 秒；`sit`、`sleep` 保持直到下一动作。相机只能由用户主动打开，平台指令不会自动开启相机或麦克风。

## 扩展示例

平台收到 `chat.text`，可将文字交给模型、检索用户授权记忆，然后返回：

```json
{
  "version": 1,
  "id": "reply-001",
  "deviceId": "dog-demo-001",
  "timestamp": "2026-10-08T08:00:01.000Z",
  "requestId": "对应用户消息 ID",
  "type": "command",
  "payload": {
    "text": "你好，今天想玩小球吗？",
    "action": "wag",
    "speak": true
  }
}
```

终端不持有模型密钥，也不检索记忆。未来可扩展音频流、经授权的图片上传、动作确认、消息去重、设备证书与用户绑定；这版协议没有实现这些生产能力。
