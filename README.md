# dividendi [![CI](https://github.com/Object501/dividendi/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/Object501/dividendi/actions/workflows/pages.yml)

一个面向手机的静态网站，用统一、可复核的口径查看：

- 当前在交易的中证 1000 股指期货（IM）各合约最新价、贴水和日化贴水；
- 自选 A 股过去 365 天已实施的每股现金分红、对应税前股息率，以及用于减少
  滚动窗口跳变的完整财年参考股息率。

界面默认使用暗色主题，也可在页首切换为浅色；浏览器会记住本机选择。
历史趋势图同时显示指标和当日收盘价：左轴为股息率或日化贴水点数，右轴为股票或期货
合约收盘价。股票图可以在“购买参考”和“已实施 365 天”之间切换。

在线站点：[object501.github.io/dividendi](https://object501.github.io/dividendi/)。

标的清单不是写死在程序里，而是统一读取
[`config/instruments.json`](config/instruments.json)。目前包含建设银行、工商银行、中国神华、
中远海控、中国平安、五粮液、伊利股份、兖矿能源、长江电力和紫金矿业。

## 计算口径

### 期货贴水

```text
贴水点数 = 同时点标的指数点位 - 期货价格
日化贴水点数 = 贴水点数 / 到期前剩余交易日数
```

贴水为正、升水为负。盘中计算包含当天交易日，日终快照从下一交易日开始计数；到期日按照
中金所规则取合约月份第三个星期五，遇非交易日顺延。

### 已实施 365 天股息率

```text
近 365 天税前股息率
= (统计日 - 365 天, 统计日] 内已派发的每股现金分红合计
  / 统计日不复权收盘价
```

现金分红以派息日为已实施日期。这个口径包括窗口内的常规分红和特别分红，但不包括尚未
派发的方案、税费、再投资收益或预测。新分红派发时会进入窗口；旧分红超过 365 天时会退出
窗口，所以即使股价不变，曲线也可能在这两个时点跳变。

### 购买参考股息率

```text
购买参考股息率
= 最近完整派息财年的常规每股现金分红合计
  / 统计日不复权收盘价
```

每个交易日都独立按当时已知的数据计算，不使用后来公告进行回看修正：

1. 仅检查截至该日已经派发的分红；
1. 找出最近一个“年度分红”已经派发的财年，将它视为最近完整派息财年；
1. 合计归属于该财年的年度、中期和季度常规现金分红；
1. 排除特别分红，再除以该交易日的不复权收盘价。

例如，某财年已派发中期分红 `¥0.18 / 股` 和年度分红 `¥0.21 / 股`，当日收盘价为
`¥10.00`，则购买参考股息率为 `(0.18 + 0.21) / 10.00 = 3.90%`。

这个口径不会因为一年前的分红机械地退出 365 天窗口而跳变。分红金额不变时，曲线只随股价
变化；新财年完成派息后才切换分红基数。如果公司完整财年分红确实增加或减少，切换时仍会
产生真实跳变。它是基于最近完整已兑现分红的试验性参考，不是未来分红预测或买卖建议。

## 数据时效性

本站不是实时行情系统。生产环境的上游数据全部由 GitHub Actions 中的 Python 采集器抓取，
浏览器不直接访问金融数据接口，只下载最近一次发布的静态 JSON。工作日交易时段的当前快照
名义上约每小时更新一次，GitHub Actions 排队或数据源延迟还可能使实际更新时间更晚；反复
刷新页面只能重新下载同一个已发布快照，不会获得实时价格，也不提供今日分钟级走势。新浪
当前行情按小时抓取；巨潮分红在行情交易日变化时才重新抓取，同一交易日内复用已校验的分红
基数，并用新价格重新计算股息率。

收盘历史每天 18:37（北京时间）尝试更新一次，只包含最近 365 天窗口内的交易日收盘快照。
任务会从现有历史的最后交易日开始增量补齐，最多自动补 10 个缺失交易日；更大的缺口会停止
并要求手工完整回填，以免意外向数据源发起大范围请求。页面会显示行情日期和抓取时间，使用
数字前应先检查这两个时间。

## 技术结构

网页源代码和构建配置统一位于 `frontend/`，使用 React、TypeScript、Vite 和按需加载的
ECharts；根目录只保留 Node.js 依赖声明、共享配置、Python 采集器和工程基础设施。构建结果
是可直接托管到 GitHub Pages 的纯静态文件。Python 采集器直接读取新浪行情和巨潮资讯公开
接口，先进行严格校验，再原子更新本地开发数据：

- `.data/latest.json`：当前行情；数值没有变化时不重写文件，浏览器以 `no-store`
  下载且只保留在内存中；
- `.data/history.json`：仅含交易日收盘快照；同日覆盖，并只保留最新交易日向前 365
  天，用户打开历史趋势时才下载；图表从同一快照读取指标与收盘价。

两份文件当前共同使用 `schemaVersion: 1`，其结构契约集中定义在
[`schema/public-data-v1.schema.json`](schema/public-data-v1.schema.json)。发布前依次验证
JSON Schema、Python 的公式与标的完整性等语义约束，并让前端从 Schema 生成的结构校验器及
手写公式复核读取即将发布的两份真实文件。生成器采用 Ajv standalone，只在开发和构建阶段
编译 Schema，浏览器不在启动时动态编译。生成目录不进入 Git；开发服务、测试、类型
检查、数据契约校验和正式构建都会先重新生成。`just publish-data` 强制依赖这套校验；
任何一层失败都不会创建或推送新的 `data` 分支提交。因此数据兼容性不只依赖采集脚本恰好
生成前端能够识别的格式。
`v1` Schema 不做破坏性修改；将来升级时必须新增版本，先部署能同时读取新旧版本的前端，
再让采集器开始写入新版本，避免 Pages 部署与定时数据任务并发造成短暂不兼容。

`.data` 不进入 Git。Nix 开发环境自动设置 `DIVIDENDI_DATA_DIR=$PWD/.data`，Vite
开发模式通过 `.env.development` 从该目录提供 JSON，因此删除 `main` 分支的数据不会影响
本地调试。生产环境则通过 `.env.production` 直接读取 GitHub 上独立的单提交 `data` 分支，
不把 JSON 打包进网站。每次数据变化都用 `--force-with-lease` 重建该分支的唯一根提交，因此
`main` 和正常克隆不会累积每日 JSON 历史。GitHub 的原始文件 CDN 最多可能缓存约 5 分钟；
此外，部分网络环境访问 `raw.githubusercontent.com` 的稳定性可能弱于 GitHub Pages。

GitHub Actions 在工作日交易时段约每小时只刷新 `latest.json`，并在每天 18:37
（北京时间）只尝试更新 `history.json`；手动运行时仍可选择更新其中一个或两者。周末、节假日
或数值未变化时不会重写 `data` 分支。数据更新工作流只采集、校验并替换 `data` 分支，不构建
或部署网站；只有 `main` 变化时才运行 GitHub Pages 构建和部署。因此定时工作流的触发次数
不变，但真实数据变化也只运行一个更新任务，不再追加 Pages 的构建和部署任务。

CI 和本地都通过 `just publish-data` 先执行相同的数据契约校验，再进入同一个
`scripts/publish-data-branch` 发布器。发布器逐字节比较远端数据，并统一调用
`scripts/data-commit-message` 生成提交文案。两份 JSON 都变化时会如实列出两行，完全没有
变化时直接退出，不创建提交或推送。

`data` 分支提交使用北京时间，标题和正文明确记录实际变化的文件，例如：

```text
chore: update data @ 2026-08-30 21:30

Files changed:
- latest.json
```

`just backfill` 会在随机节流下重新抓取最近 365 个自然日内的全部交易日，但只改写本地
`.data/history.json`，不会自动发布。检查后需显式运行：

```sh
just backfill
just validate
just publish-data
```

## 开发

项目使用 Nix 提供完整工具链，支持 `aarch64-darwin`、`aarch64-linux` 和
`x86_64-linux`。JavaScript 依赖由 pnpm 锁定，并通过 Nixpkgs 的 pnpm 构建钩子打包；
Python 依赖来自固定的 Nixpkgs 和仓库 overlay，不使用 uv 或 pip 环境。

两个 GitHub Actions 工作流都通过 Magic Nix Cache 复用 GitHub Actions 自带的缓存，
不需要外部账户或密钥，并关闭 FlakeHub 与诊断数据上报。`cache.nixos.org` 已有的构建结果
仍直接取自官方缓存，不重复上传。GitHub 默认会删除连续超过 7 天未访问的缓存，并为每个
仓库免费保留最多 10 GB；这不是固定每 7 天清空一次。定时数据任务会持续访问有效缓存，
本地开发则仍使用本机的 Nix store，不依赖 CI 缓存。

Dependabot 每周一检查 pnpm 和 GitHub Actions 更新；依赖中的 minor/patch 更新按运行时与
开发用途分组，major 更新保持独立，Actions 更新合并为一组。安全告警和安全更新也已开启。
每个依赖 PR 都会以只读权限运行完整 Nix 检查，不会部署 Pages。Dependabot 不支持 Nix
flake 输入；npm/pnpm 更新改变锁文件后，合并前还必须清空
`nix/package.nix` 中的旧 `fetchPnpmDeps` 哈希、运行 `nix build`，再填入错误信息给出的
新哈希。

仓库只允许 squash merge 和 rebase merge，不允许额外的 merge commit。所有 PR 标题都复用
仓库的 gitlint 提交格式校验；Dependabot 标题缺少末尾句点时会由只处理可信基础分支的工作流
自动补齐。squash merge 的最终标题固定取 PR 标题且正文留空，因此 Dependabot PR 应使用
squash；只有分支中每条提交本身都符合格式时才使用 rebase。

```sh
nix develop
just setup     # 安装锁定的前端依赖
just generate-data-validator # 可选：单独生成前端结构校验器
just check     # 格式、静态检查、类型检查和单元测试
just data      # 抓取并验证最新行情
just history   # 抓取官方收盘并更新滚动历史
just backfill  # 带随机节流地重建最近 365 天收盘历史
just validate  # 校验待发布的最新行情和历史
just publish-data # 使用统一格式替换远端 data 分支
just build     # 构建静态网站
just ci        # 执行 Nix 检查
```

数据源：[新浪财经](https://finance.sina.com.cn/)、[巨潮资讯](https://webapi.cninfo.com.cn/)、
[中国金融期货交易所](https://www.cffex.com.cn/zz1000/)。免费公开接口不提供可用性保证；网站
显示数据日期和抓取时间，内容仅供个人研究，不构成投资建议。

本项目以 GPL-3.0 许可证发布。Dividendi 在拉丁文中意为“关于股息的”。
