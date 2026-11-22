# Antigravity Quota (AGY)

English | [简体中文](README.zh-CN.md)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Do-er/antigravity-quota-plus/blob/main/LICENSE)
[![Open VSX](https://img.shields.io/open-vsx/v/Doer/antigravity-quota-plus?color=purple&label=Open%20VSX)](https://open-vsx.org/extension/Doer/antigravity-quota-plus)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/Doer/antigravity-quota-plus?color=purple&label=Downloads)](https://open-vsx.org/extension/Doer/antigravity-quota-plus)
[![VS Marketplace](https://vsmarketplacebadges.dev/version/Doer.antigravity-quota-plus.svg)](https://marketplace.visualstudio.com/items?itemName=Doer.antigravity-quota-plus)

A lightweight **Antigravity IDE** usage tracker that monitors your AI **quota** and **rate limits** right in the **status bar** — track both **5-hour (`5h`) sliding limits** and **weekly (`7d`) limits** for **Gemini**, **Claude**, **GPT**, and **Gemini 4 Argon** with live reset countdowns.

---

## Features

- **All-Model Dual-Window Tracking**: Automatically detects and syncs all model groups supported by Antigravity, displaying remaining percentages and reset countdowns for both `5h` and `7d` windows.
- **Compact Status Bar & Hover Card**: Uses superscript tags (`ʰ` / `ʷ`) in the status bar to save space, and reveals a clean aligned tooltip card on hover.

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

- **Quick Pin Menu**: Click the status bar item to toggle which quota buckets stay pinned in the status bar and view exact reset timestamps.

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

- **Zero-Config Auto Discovery**: Automatically detects the local Antigravity language server port and credentials with no manual setup required.

---

## Configuration

Search **`AGQ`** in Settings (`Ctrl+,` / `Cmd+,`) to customize:

| Setting | Default | Description |
| :--- | :--- | :--- |
| `agq.enabled` | `true` | Enable automatic quota monitoring |
| `agq.pollingInterval` | `120` | Background polling interval in seconds (minimum `30`) |
| `agq.pinnedBuckets` | `[]` | Quota bucket IDs pinned to the status bar (empty = show all) |

---

## Installation

### Option 1: Open VSX Registry (Recommended)
Install directly from [Open VSX](https://open-vsx.org/extension/Doer/antigravity-quota-plus) or search **`Antigravity Quota (AGY)`** in the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`).

Or install via CLI:
```bash
agy --install-extension Doer.antigravity-quota-plus
```

### Option 2: VS Code Marketplace
Search **`Antigravity Quota (AGY)`** in VS Code Extensions or visit the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Doer.antigravity-quota-plus).

### Option 3: Install from VSIX
1. Download the latest `.vsix` file from [GitHub Releases](https://github.com/Do-er/antigravity-quota-plus/releases).
2. Open the Extensions panel -> click `···` -> **Install from VSIX...**

---

## Development & Publishing

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package as VSIX
npm run node:vsix:package

# Build and publish to Open VSX (requires OVSX_PAT in .env or environment)
npm run publish:ovsx
```

---

## Acknowledgements & License

- Inspired by early community projects such as [Henrik-3/AntigravityQuota](https://github.com/Henrik-3/AntigravityQuota), redesigned and enhanced for multi-group tracking.
- Licensed under the [MIT License](https://github.com/Do-er/antigravity-quota-plus/blob/main/LICENSE).
