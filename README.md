# dividendi [![CI](https://github.com/Object501/dividendi/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/Object501/dividendi/actions/workflows/pages.yml)

一个面向手机的静态网站，用统一口径查看中证 1000 股指期货（IM）各在交易合约的最新价、贴水与日化贴水，以及自选 A 股过去 365 天已实施股息率和完整财年购买参考股息率。界面默认使用暗色主题，历史图以左右双轴同时显示指标与同日收盘价。

在线站点：[object501.github.io/dividendi](https://object501.github.io/dividendi/)。标的统一配置在 [`config/instruments.json`](config/instruments.json)，目前包括建设银行、工商银行、中国神华、中远海控、中国平安、五粮液、伊利股份、兖矿能源、长江电力和紫金矿业。

## 计算口径

### 期货贴水

```text
贴水点数 = 同一时点标的指数点位 - 期货价格
日化贴水点数 = 贴水点数 / 到期前剩余交易日数
```

正数表示贴水，负数表示升水。盘中计算包含当天，日终快照从下一交易日开始；到期日为合约月份第三个星期五，遇非交易日顺延。

### 已实施 365 天股息率

```text
近 365 天税前股息率
= (统计日 - 365 天, 统计日] 内已派发的每股现金分红
  / 统计日不复权收盘价
```

按派息日统计常规和特别分红，不含尚未派发的方案、税费、再投资收益或预测。新分红进入或旧分红退出窗口时，即使股价不变，曲线也可能跳变。

### 购买参考股息率

```text
购买参考股息率
= 最近完整派息财年的常规每股现金分红
  / 统计日不复权收盘价
```

每个交易日只使用当时已知且已派发的数据。最近完整财年是年度分红已经派发的最近财年；合计其年度、中期和季度常规现金分红，排除特别分红。例如，中期和年度每股分别派发 `¥0.18` 与 `¥0.21`，收盘价为 `¥10.00`，购买参考股息率为 `(0.18 + 0.21) / 10.00 = 3.90%`。

这个口径避免旧分红机械退出 365 天窗口，但会在新财年完成派息、分红基数真实变化时调整。所有结果均为税前历史参考，不是预测或投资建议。

## 数据与时效

本站不是实时行情系统，也不发布 `latest.json`。浏览器先读取本机保存的最近成功快照，再下载 `history.json` 的最新日终基准，并直接向东方财富请求约延迟 15 分钟的股票、指数、在交易合约和已公布 A 股休市安排，在浏览器内计算最新贴水、剩余交易日和股息率。

- 最新计算结果只持久化在浏览器本机；失败时显示上次成功结果。客户端绝不把盘中数据写回 GitHub，也不会触发 Pages 部署。
- 浏览器首次打开时请求行情，5 分钟内重新载入则直接使用本机缓存；页面可见、联网且处于中国市场时段时名义上每小时刷新。同一浏览器持久化刷新尝试时间，失败也计入间隔。
- 每个工作日 19:23（北京时间）只有一个 GitHub Actions 定时任务，增量更新 `history.json`。GitHub 调度和数据源都可能延迟。
- `history.json` 从最后交易日增量补齐最近 365 天的日终快照。自动补齐最多 10 个交易日，更大缺口必须手工运行 `just backfill`。
- 页面明确区分行情日期、行情自身时间与本机缓存；使用数值前请检查数据可能有多旧。

`history.json` 同日覆盖，只保留 `(最新交易日 - 365 天, 最新交易日]` 的交易日收盘快照；浏览器启动时读取它作为分红和日终计算基准，图表代码仍按需加载。每日任务在文件字节没有变化时不会提交。

文件使用 `schemaVersion: 1`，结构定义在 [`schema/public-data-v1.schema.json`](schema/public-data-v1.schema.json)。发布前依次执行 JSON Schema、Python 语义和前端解析校验；前端从 Schema 生成结构校验器，再独立复核公式和标的完整性。生成目录不进入 Git，开发、测试、类型检查和构建都会先重新生成。升级数据版本时须先部署兼容新旧版本的前端，再切换采集器。

本地数据位于忽略的 `.data`，Nix 开发环境自动设置 `DIVIDENDI_DATA_DIR=$PWD/.data`。生产环境直接读取独立的单提交 `data` 分支，不把 JSON 打包进 Pages；数据更新不会触发网站部署。发布器逐字节比较远端数据，无变化时不提交，有变化时以 `--force-with-lease` 替换唯一根提交。原始文件 CDN 可能缓存约 5 分钟。

本地和 CI 都通过 `just publish-data` 调用同一发布器。提交标题使用北京时间，正文列出实际变化的文件：

```text
chore: update data @ 2026-08-30 21:30

Files changed:
- history.json
```

完整回填带随机节流，只改写本地历史，检查后再显式发布：

```sh
just backfill
just validate
just publish-data
```

## 开发

项目使用 Nix 提供工具链，支持 `aarch64-darwin`、`aarch64-linux` 和 `x86_64-linux`。JavaScript 依赖由 pnpm 锁定并通过 Nixpkgs 构建；Python 依赖来自固定的 Nixpkgs 和仓库 overlay，不使用 uv、pip 环境或 node2nix。

```sh
nix develop
just setup     # 安装前端依赖
just check     # 格式、静态检查、类型检查和测试
just history   # 增量更新收盘历史
just backfill  # 重建最近 365 天收盘历史
just validate  # 校验待发布数据
just publish-data # 发布 data 分支
just build     # 构建静态网站
just ci        # 执行完整 Nix 检查
```

GitHub 工作流使用仓库级 Magic Nix Cache。Dependabot 每周检查 pnpm 和 GitHub Actions；pnpm 锁文件变化后仍须更新 `nix/package.nix` 中的 `fetchPnpmDeps` 哈希，Nix flake 输入则不由 Dependabot 更新。

仓库只允许 squash 和 rebase。PR 标题使用 gitlint；Dependabot 标题会删除已有 `(#N)` 并补齐句点，校验时再加上当前 PR 号，确保最终 squash 标题不超过 72 个字符。

## 数据源与许可

盘中行情、合约目录和休市安排来自[东方财富](https://quote.eastmoney.com/)，日终历史使用[巨潮资讯](https://webapi.cninfo.com.cn/)、[中国金融期货交易所](https://www.cffex.com.cn/zz1000/)和 BaoStock。免费公开接口不保证可用性，内容仅供个人研究，不构成投资建议。

本项目使用 GPL-3.0 许可证。Dividendi 在拉丁文中意为“关于股息的”。
