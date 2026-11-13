# AGY Quota

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Do-er/antigravity-quota-plus/blob/main/LICENSE)
[![VS Marketplace](https://vsmarketplacebadges.dev/version/Doer.antigravity-quota-plus.svg)](https://marketplace.visualstudio.com/items?itemName=Doer.antigravity-quota-plus)
[![Open VSX](https://img.shields.io/open-vsx/v/Doer/antigravity-quota-plus?color=purple&label=Open%20VSX)](https://open-vsx.org/extension/Doer/antigravity-quota-plus)
[![GitHub issues](https://img.shields.io/github/issues/Do-er/antigravity-quota-plus)](https://github.com/Do-er/antigravity-quota-plus/issues)

极致轻量高效的 Antigravity IDE 插件，用于在状态栏实时监控 Antigravity 所支持全部 AI 模型的 **5小时滑动配额** 与 **周配额** 剩余及刷新倒计时。

---

## 核心特性

- **全模型双限制追踪**：自动识别并同步 Antigravity 支持的所有模型组，实时掌握各模型的 **5H 滑动限制** 与 **周限制**。
- **极简状态栏与悬浮卡片**：采用微标角标紧凑呈现，鼠标悬停即浮现清晰的刷新倒计时卡片。

  ```text
      ┌──────────────────────────────────┐
      │ ✦ Gemini Models                  │
      │ 5H  68.7%                  1h24m │
      │ 周  97.0%                  6d22h │
      │                                  │
      │ ✺ Claude and GPT models          │
      │ 5H   0.0%                  1h45m │
      │ 周  60.1%                  4d23h │
      │                                  │
      │ ✦ Gemini 4 Argon                 │
      │ 周  98.8%                  6d23h │
      └─────────────────┬────────────────┘
                        ▼
  ───────────────────────────────────────────────────────
    ✦ 69%ʰ·97%ʷ   ✺ 0%ʰ·60%ʷ   ✦ 99%ʷ   Antigravity
  ```
- **自由交互管理菜单**：点击状态栏即可呼出极简菜单，自由勾选固定配额项。

  ```text
  ┌──────────────────────────────────────────────────────────────────┐
  │                             AGY Quota                            │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▣  5H  ▓▓▓▓▓▓▓░░░ 68.7%                            Gemini Models │
  │    1h24m · 10/07 14:42                                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▣  周  ▓▓▓▓▓▓▓▓▓▓ 97.5%                                          │
  │    6d23h · 10/07 11:22                                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▣  5H  ░░░░░░░░░░  0.0%                    Claude and GPT models │
  │    1h45m · 09/30 15:03                                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▢  周  ▓▓▓▓▓▓░░░░ 60.1%                                          │
  │    4d23h · 10/05 13:10                                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ▣  周  ▓▓▓▓▓▓▓▓▓▓ 98.8%                           Gemini 4 Argon │
  │    6d23h · 11/04 10:22                                           │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **零配置即开即用**：自动探测 Antigravity 语言服务进程端口与认证凭据，无需任何手动配置。

---

## 配置项

在 VS Code 设置（`Ctrl+,`）中搜索 **AGQ** 进行个性化配置：

| 配置项 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `agq.enabled` | `true` | 是否启用自动配额监控 |
| `agq.pollingInterval` | `120` | 后台轮询间隔时间（秒，最低 30s） |
| `agq.pinnedBuckets` | `[]` | 状态栏显示的配额项 ID 列表（留空默认全部显示） |

---

## 安装方式

### 方式 1：VS Code 扩展市场安装
在 VS Code 或 Antigravity 扩展面板（`Ctrl+Shift+X`）搜索 **`AGY Quota`**，点击安装即可。

### 方式 2：VSIX 本地安装
1. 从 Release 页面下载最新的 `.vsix` 文件。
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
```

---

## 致谢与开源协议
 
- 本项目基于 [Henrik-3/AntigravityQuota](https://github.com/Henrik-3/AntigravityQuota) 等早期社区项目的灵感与实践进行深度增强重构。
- 遵循 [MIT License](https://github.com/Do-er/antigravity-quota-plus/blob/main/LICENSE) 开源协议。
