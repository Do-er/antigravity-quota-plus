# CHANGELOG

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
