# Flexbar Race Telemetry

Flexbar 横向赛车仪表插件。当前版本直接接收 Forza Horizon、Forza Motorsport 和 EA SPORTS F1 25 的 UDP 遥测，显示挡位、实时转速和左右对称换挡灯。

## 当前功能

- Forza Horizon 5 `Data Out`（323/324 字节 Horizon Dash 包）
- 兼容 Forza Motorsport Dash（311 字节）
- 支持 EA SPORTS F1 25 原版 UDP 模式和 F1 25: 2026 Season Pack UDP 模式
- 自动同时监听 Forza `9999` 与 F1 `20777`，无需依赖 FlexDesigner 保存来源切换
- F1 自动按包头中的玩家车辆索引读取挡位、RPM，并从 Car Status 包读取该车最大 RPM
- F1 换挡灯将游戏输出的 15 位 `revLightsBitValue` 与 `revLightsPercent` 直接映射到灯段，不再套用 Forza 的转速阈值
- 自动把 Forza Horizon 挡位编码转换为 `R`、`1...`
- 挡位直接读取 Horizon 包偏移 319 / Motorsport 包偏移 307 的 `Gear` 字段
- 相邻挡位立即显示；只有异常跨挡才用连续包确认，过滤换挡瞬间的单帧错误值
- 将 FH5 降挡期间短暂上报的 `Gear=11` 解释为换挡中状态并显示 `N`；灯光仍按真实 RPM 工作
- 2170 × 60 Direct Draw 仪表
- 可在按键的“功能”页切换画面旋转 180°
- 点击 Flexbar 中间区域，可循环切换“挡位＋转速 / 纯挡位 / 纯转速”，软件功能页也可选择
- 左右对称绿色、黄色、红色换挡灯
- 到达换挡阈值后紫白闪烁
- 遥测超时和比赛暂停状态
- UDP 解析器、挡位转换和换挡灯逻辑的离线测试

## Forza Horizon 5 设置

在游戏的 HUD/游戏性设置中找到 `DATA OUT`：

```text
Data Out: On
Data Out IP Address: 127.0.0.1
Data Out IP Port: 9999
```

插件默认监听 UDP `0.0.0.0:9999`。如果游戏和 FlexDesigner 不在同一台电脑上，把游戏里的目标 IP 改为运行 FlexDesigner 电脑的局域网地址，并在 Windows 防火墙中允许对应 UDP 端口。

## EA SPORTS F1 25 设置

先在 FlexDesigner 的插件“功能”页将遥测来源切换为 `EA SPORTS F1 25 / 2026 赛季包`，端口会自动改为 `20777`。然后在 F1 25 的遥测设置中配置：

```text
UDP Telemetry: On
UDP Broadcast Mode: Off
UDP IP Address: 127.0.0.1
UDP Port: 20777
UDP Send Rate: 60Hz
UDP Format: 2025（或当前默认的 2026 Season Pack）
```

插件会根据包头自动区分 2025 与 2026 格式，不需要再手动选择协议版本。游戏与 FlexDesigner 不在同一台电脑时，将 IP 改成运行 FlexDesigner 电脑的局域网地址。

## 开发命令

建议使用 Node.js 20。官方 FlexCLI 1.0.7 仍使用旧版 JSON import assertion，在 Node.js 24 下无法启动：

```bash
npm install
npm test
npm run build
```

构建会按官方示例使用 Rollup，把 SDK 与业务模块打包到插件的 `backend/plugin.cjs`。插件目录为：

```text
com.zikai.racetelemetry.plugin/
```

校验并打包：

```bash
npm run plugin:validate
npm run plugin:pack
```

生成的 `.flexplugin` 可以通过 FlexDesigner/FlexCLI 安装。

## 调整参数

默认参数位于 `com.zikai.racetelemetry.plugin/config.json`，也可以在 FlexDesigner 的按键配置中为单个仪表修改：

- `udpPort`: UDP 监听端口
- `source`: `forza-horizon`、`forza-motorsport` 或 `f1-25`
- `renderFps`: 向 Flexbar 输出的最大帧率
- `lightsStartRatio`: 开始亮灯的转速比例
- `redlineRatio`: 红灯区域起点
- `flashRatio`: 紫白闪烁起点
- `telemetryTimeoutMs`: 多久未收到包后显示 `NO DATA`
- `rotate180`: 将这个仪表按键的完整画面旋转 180°
- `diffUpdate`: 建议保持 `false`；FlexDesigner 2.2.3 的首帧局部刷新可能发生区域越界

Forza 的转速比例按 `CurrentEngineRpm / EngineMaxRpm` 计算。F1 25 则直接使用游戏提供的 rev-light 位图，并继续显示实际 RPM 和车辆最大 RPM。

## 架构

```text
游戏适配器 -> 统一 TelemetrySnapshot -> DashboardRenderer -> Flexbar Direct Draw
```

新增游戏时只需实现一个输出统一快照的输入适配器，不需要修改仪表渲染器。

## 限制

- 不同车辆显示的换挡灯阈值会随遥测 `EngineMaxRpm` 自动变化，但 Forza 没有输出真正的最佳换挡转速；F1 25 使用游戏原生换挡灯数据。
- Direct Draw 需要 FlexDesigner SDK 1.0.7 或更高版本。
- 一个 UDP 端口通常只能被一个程序稳定占用；如果同时使用 SimHub，需要配置 UDP 转发或不同端口。

## 许可证

本项目使用 [MIT License](LICENSE) 开源。
