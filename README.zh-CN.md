# Antigravity Quota (AGY)

[English](README.md) | 简体中文

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Do-er/antigravity-quota-plus/blob/main/LICENSE)
[![Open VSX](https://img.shields.io/open-vsx/v/Doer/antigravity-quota-plus?color=purple&label=Open%20VSX)](https://open-vsx.org/extension/Doer/antigravity-quota-plus)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/Doer/antigravity-quota-plus?color=purple&label=Downloads)](https://open-vsx.org/extension/Doer/antigravity-quota-plus)
[![VS Marketplace](https://vsmarketplacebadges.dev/version/Doer.antigravity-quota-plus.svg)](https://marketplace.visualstudio.com/items?itemName=Doer.antigravity-quota-plus)

极致轻量高效的 Antigravity IDE 插件，用于在状态栏实时监控 Antigravity 所支持全部 AI 模型（**Gemini**、**Claude**、**GPT** 与 **Gemini 4 Argon**）的 **5小时滑动配额 (`5h`)** 与 **周配额 (`7d`)** 剩余及刷新倒计时。

---

## 核心特性

- **全模型双限制追踪**：自动识别并同步 Antigravity 支持的所有模型组，实时掌握各模型的 `5h` 滑动限制与 `7d` 周限制。
- **极简状态栏与悬浮卡片**：状态栏采用角标（`ʰ` / `ʷ`）紧凑呈现，鼠标悬停即浮现对齐的进度条与倒计时卡片。

  ```text
      ┌─────────────────────────────────────┐
      │ ✦ Gemini Models                     │
      │ 5h ●●●●●●●○○○ 1h24m           68.7% │
      │ 7d ●●●●●●●●●○ 6d22h           97.0% │
      │                                     │
      │ ✺ Claude and GPT Models             │
      │ 5h ○○○○○○○○○○ 1h45m            0.0% │
      │ 7d ●●●●●●○○○○ 4d23h           60.1% │
      │                                     │
      │ ✦✦ Gemini 4 Argon                   │
      │ 7d ●●●●●●●●●● 6d23h           98.8% │
      └──────────────────┬──────────────────┘
                         ▼
  ──────────────────────────────────────────────────────────
    ✦ 69%ʰ · 97%ʷ   ✺ 0%ʰ · 60%ʷ   ✦✦ 99%ʷ   Antigravity
  ```

- **自由交互管理菜单**：点击状态栏即可呼出极简菜单，自由勾选固定配额项并查看具体重置时刻。

  ```text
  ┌──────────────────────────────────────────────────────────────────┐
  │                             AGY Quota                            │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▣  5h  ●●●●●●●○○○ 68.7%                            Gemini Models │
  │    1h24m · 10/07 14:42                                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▣  7d  ●●●●●●●●●● 97.5%                                          │
  │    6d23h · 10/07 11:22                                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▣  5h  ○○○○○○○○○○  0.0%                    Claude and GPT Models │
  │    1h45m · 09/30 15:03                                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▢  7d  ●●●●●●○○○○ 60.1%                                          │
  │    4d23h · 10/05 13:10                                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▣  7d  ●●●●●●●●●● 98.8%                           Gemini 4 Argon │
  │    6d23h · 11/04 10:22                                           │
  └──────────────────────────────────────────────────────────────────┘
  ```

- **零配置即开即用**：自动探测 Antigravity 语言服务进程端口与认证凭据，无需任何手动配置。

---

## 配置项

在设置（`Ctrl+,` / `Cmd+,`）中搜索 **`AGQ`** 进行个性化配置：

| 配置项 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `agq.enabled` | `true` | 是否启用自动配额监控 |
| `agq.pollingInterval` | `120` | 后台轮询间隔时间（秒，最低 `30`） |
| `agq.pinnedBuckets` | `[]` | 状态栏显示的配额项 ID 列表（留空默认全部显示） |

---

## 安装方式

### 方式 1：Open VSX 扩展市场（推荐）
在 [Open VSX](https://open-vsx.org/extension/Doer/antigravity-quota-plus) 直接安装，或在扩展面板（`Ctrl+Shift+X` / `Cmd+Shift+X`）搜索 **`Antigravity Quota (AGY)`**。

也可通过命令行安装：
```bash
agy --install-extension Doer.antigravity-quota-plus
```

### 方式 2：VS Code 扩展市场
在 VS Code 扩展面板搜索 **`Antigravity Quota (AGY)`**，或访问 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Doer.antigravity-quota-plus)。

### 方式 3：VSIX 本地安装
1. 从 [GitHub Releases](https://github.com/Do-er/antigravity-quota-plus/releases) 下载最新的 `.vsix` 文件。
2. 打开扩展面板 -> 点击右上角 `···` -> 选择 **“从 VSIX 安装... (Install from VSIX...)”**。

---

## 本地编译与打包

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 打包为 VSIX 安装包
npm run node:vsix:package

# 一键打包并发布到 Open VSX（需先在 .env 或环境变量中配置 OVSX_PAT）
npm run publish:ovsx
```

---

## 致谢与开源协议

- 本项目基于 [Henrik-3/AntigravityQuota](https://github.com/Henrik-3/AntigravityQuota) 等早期社区项目的灵感与实践进行深度增强重构。
- 遵循 [MIT License](https://github.com/Do-er/antigravity-quota-plus/blob/main/LICENSE) 开源协议。
