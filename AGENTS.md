# AGENTS.md

Project rules for maintaining marketplace metadata and documentation when features or UI change.

## Sync Checklist on Any Feature / UI Change

Whenever model groups, quota windows, status bar / tooltip / QuickPick UI, settings, or commands change, update these files in the same task:

1. **`package.json`**
   - **`description`**: Update promptly whenever supported models, quota windows, or core capabilities change. Keep high-intent search terms (`Antigravity`, `AI quotas`, `usage`, `rate limits`, `status bar`, active model names, and window labels) concise and accurate.
   - **`categories`**: Keep `["AI", "Visualization", "Other"]` (do not narrow back to `["Other"]`).
   - **`keywords`**: Keep at most **5** core keywords (`vsce` limit); place long-tail terms in `description` and `README.md`.
   - **`version`**: Bump together with `package-lock.json` and `CHANGELOG.md` on release.

2. **`README.md` (Primary English Doc)**
   - Keep English as the primary language for Open VSX / VS Marketplace search and conversion, with `[简体中文](README.zh-CN.md)` at the top.
   - Update UI previews (group icons like `✦` / `✦✦` / `✺`, window labels like `5h` / `7d`, progress bar style `●`/`○`, and layout), configuration table, and install/publish commands whenever the implementation changes.
   - Keep Open VSX as the primary install option; avoid duplicate command blocks or badges for disabled repo features (e.g. GitHub Issues).

3. **`README.zh-CN.md` (Chinese Mirror)**
   - Keep structurally in sync with `README.md` on every documentation or UI update, with `[English](README.md)` at the top.
