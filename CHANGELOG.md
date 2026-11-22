# CHANGELOG

## 1.0.8 (2026-11-23)

### 优化与改进

- **重构悬浮卡片（Tooltip）排版**：将多组独立表格合并为单张两列对齐表格（左列展示加粗周期标签、等宽圆点进度条与倒计时，右列右对齐展示剩余百分比），消除分组间多余表头空隙
- **统一进度条与周期标识**：进度条由 `▓`/`░` 升级为 `●`/`○`（等宽呈现），周期标签由 `5H`/`周` 统一为 `5h`/`7d`（Tooltip 与 QuickPick 菜单同步生效）
- **调整 Argon 分组图标**：将 `Gemini 4 Argon` 前缀由 `◆` 更换为双星 `✦✦`，与常规 Gemini 分组（`✦`）保持系列一致性并体现高阶档位区分
- **优化扩展市场检索与文档**：将 `README.md` 升级为英文主文档并新增 `README.zh-CN.md`；在 `package.json` 中新增 `AI`、`Visualization` 分类与深色 `galleryBanner`，优化描述与核心关键词

## 1.0.7 (2026-11-22)

### 修复

- **修复 macOS（及部分新版 Windows/Linux 构建）上始终提示「Antigravity process not found」的问题**：新版 `agy --hub` 不再把 `--csrf_token` 放在命令行，而是写入 `~/.gemini/<app_data_dir>/daemon/hub_<hub_port>.json`（含 `csrfToken`、`httpsPort`、`httpPort`、`lsVersion`）。原逻辑把「命令行没有 token」直接判定为非目标进程并丢弃，导致进程明明在运行却检测失败
- 新增 `hub_discovery.ts`：按 `--app_data_dir` + `--hub-port` 定位发现文件，并以 PID 校验避免读到上一次会话的残留文件；`--hub-port` 缺失时按 PID 在 `daemon/` 目录中匹配
- 端口探测改为 HTTPS → HTTP 自适应：`agy` 的 `httpsPort` 提供 TLS 接口，`--hub-port` 为明文 Connect-RPC，探测顺序为「发现文件的 httpsPort → 系统端口 → 命令行的 hub-port → 发现文件的 httpPort」，协商结果一路传给 `QuotaManager`
- 进程扫描全部落空时，新增按发现文件兜底的连接路径，二进制再次改名也不会彻底失效
- 多个候选进程时，优先选择命令行已自带 token 的那个

### 说明

- 旧的 `language_server_*` + `--csrf_token` 形态行为不变；无 `--hub` 标记且无 token 的进程仍会被正确跳过
- Windows（PowerShell / WMIC）与 Linux 复用同一套解析与探测逻辑

## 1.0.6 (2026-11-21)

### 修复与清理

- 修复端口健康检查失效问题：将探测接口从已下线的 `GetUnleashData` 替换为 `RetrieveUserQuotaSummary`
- 移除已过时的旧版 `language_server_*` 进程及 `--extension_server_port` / `hub_port + 2` 兼容逻辑，仅保留 `agy` / `agy.exe`

## 1.0.5 (2026-11-20)

### 优化与修复

- 启动初期 10 次检测失败后，转为每 30 秒后台轮询检测，支持 `agy` 延迟拉起、延后登录或代理开启后的自动恢复连接
- 点击状态栏菜单时，若扩展尚未初始化完成，自动触发一次立即检测
- 修复 `pgrep`/`grep` 未匹配进程返回退出码 1 时抛出异常、导致命令行兜底搜索未执行的问题

## 1.0.4 (2026-11-13)

### 优化与改进

- 更名为 **AGY Quota**，并新增启动时进程检测指数退避重试机制（最多 10 次），避免 IDE 启动初期过早检测失败
- 重构悬浮卡片排版：采用两列对齐表格（左列 `5H`/`周` + 百分比，右列无空格倒计时），标题保留原名并加上 `✦`/`✺` 图标，且仅展示已勾选的模型组
- 精简快捷菜单两行文案（`5H` / `周` 与 `倒计时 · MM/DD HH:mm`），并更新 `README.md` 为纯文本图表预览

## 1.0.3 (2026-10-28)

### 修复

- 兼容 Antigravity IDE v2.6：语言服务器进程由 `language_server_*` 更名为 `agy`，现在同时匹配新旧两种进程名
- 适配 `agy` 的 `--hub-port` 参数（API 实际监听 `hub_port + 2`），并支持 `--app_data_dir=antigravity` 等号写法
- 新增按命令行参数搜索进程的后备方案，并在端口查询失败时继续探测命令行中的已知端口
- 修复 Unix 平台解析 `ps` 输出时未去除行首空白，导致 PID 截取错误、命令行被截断的问题

## 1.0.2 (2026-10-04)

- 迁移项目源码托管至 GitHub: [Do-er/antigravity-quota-plus](https://github.com/Do-er/antigravity-quota-plus)
- 规范扩展元数据配置，完善 `bugs`、`homepage` 以及 `repository` 字段
- 更新打包脚本中的资源基地址为 GitHub CDN，保障插件市场详情页资源稳定加载
- 梳理致谢与开源协议链接

## 1.0.1

- 升级为 Antigravity Quota Plus，重构支持双重滑动配额（5-Hour & Weekly）监控与极简状态栏呈现
- Add absolute date and time to quota reset information (locale-aware)
- Add notice/mention of the source project
- Fix macOS port detection logic by using AND semantics in `lsof`
- Improve port validation to prevent false positives from unrelated local services
- Add PID verification for all discovered listening ports

## 1.0.7 (2025-12-17)

- Added naming scheme for Gemini 3 Flash
