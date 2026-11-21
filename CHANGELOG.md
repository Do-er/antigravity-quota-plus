# CHANGELOG

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
