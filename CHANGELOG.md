# CHANGELOG

## 1.0.3 (2026-10-28)

### 修复
- 适配 Antigravity 2.x：语言服务器进程由 `language_server_*` 更名为 `agy.exe`，原按进程名查询会返回空结果导致「Antigravity process not found」，现在同时匹配新旧两种进程名
- 修复 `--app_data_dir=antigravity`（等号连接写法）无法被识别为 Antigravity 进程的问题，此前仅支持空格分隔
- 适配 `agy` 的 `--hub-port` 参数：语言服务器 API 实际监听 `hub_port + 2`，原逻辑仅识别 `--extension_server_port`
- 新增按命令行参数（`--app_data_dir=antigravity`）搜索进程的后备方案，避免后续进程再次更名导致失效
- 进程检测失败时，即使系统端口查询无权限或返回为空，也会继续探测命令行中已知的端口
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
