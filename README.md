# dividendi [![CI](https://github.com/Object501/dividendi/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/Object501/dividendi/actions/workflows/pages.yml)

一个面向手机的静态网站，用统一、可复核的口径查看：

- 当前在交易的中证 1000 股指期货（IM）各合约贴水和日化贴水；
- 自选 A 股过去 365 天已实施现金分红对应的税前股息率。

在线站点：[object501.github.io/dividendi](https://object501.github.io/dividendi/)。

标的清单不是写死在程序里，而是统一读取
[`config/instruments.json`](config/instruments.json)。目前包含建设银行、工商银行、中国神华、
中远海控、中国平安、五粮液和伊利股份。

## 计算口径

```text
贴水点数 = 同时点标的指数点位 - 期货价格
日化贴水点数 = 贴水点数 / 到期前剩余交易日数
近 365 天税前股息率 = 过去 365 天已派发的每股现金分红 / 最近不复权价格
```

贴水为正、升水为负。盘中计算包含当天交易日，日终快照从下一交易日开始计数。现金分红以
派息日为已实施日期，不包含尚未派发的方案、税费或再投资收益。

## 数据时效性

本站不是实时行情系统。生产环境的上游数据全部由 GitHub Actions 中的 Python 采集器抓取，
浏览器不直接访问金融数据接口，只下载最近一次发布的静态 JSON。工作日交易时段的当前快照
名义上约每小时更新一次，GitHub Actions 排队或数据源延迟还可能使实际更新时间更晚；反复
刷新页面只能重新下载同一个已发布快照，不会获得实时价格，也不提供今日分钟级走势。

收盘历史每天 18:37（北京时间）尝试更新一次，只包含最近 365 天窗口内的交易日收盘快照。
页面会显示行情日期和抓取时间，使用数字前应先检查这两个时间。

## 技术结构

网页使用 React、TypeScript、Vite 和按需加载的 ECharts，构建结果是可直接托管到 GitHub
Pages 的纯静态文件。Python 采集器直接读取新浪行情和巨潮资讯公开接口，先进行严格校验，再
原子更新本地开发数据：

- `.data/latest.json`：当前行情；数值没有变化时不重写文件，浏览器以 `no-store`
  下载且只保留在内存中；
- `.data/history.json`：仅含交易日收盘快照；同日覆盖，并只保留最新交易日向前 365
  天，用户打开历史趋势时才下载。

`.data` 不进入 Git。Nix 开发环境自动设置 `DIVIDENDI_DATA_DIR=$PWD/.data`，Vite
开发模式通过 `.env.development` 从该目录提供 JSON，因此删除 `main` 分支的数据不会影响
本地调试。生产数据保存在独立的单提交 `data` 分支，构建时才检出到 `public/data`。
每次数据变化都用 `--force-with-lease` 重建该分支的唯一根提交，因此 `main` 和正常克隆不会
累积每日 JSON 历史。

GitHub Actions 在工作日交易时段约每小时刷新当前快照，并在每天 18:37（北京时间）尝试
更新官方收盘历史。周末、节假日或数值未变化时不会重写 `data` 分支，也不会触发 Pages
部署；`main` 更新和真实数据变化各自只部署一次。

## 开发

项目使用 Nix 提供完整工具链，支持 `aarch64-darwin`、`aarch64-linux` 和
`x86_64-linux`。JavaScript 依赖由 pnpm 锁定，并通过 Nixpkgs 的 pnpm 构建钩子打包；
Python 依赖来自固定的 Nixpkgs 和仓库 overlay，不使用 uv 或 pip 环境。

```sh
nix develop
just setup     # 安装锁定的前端依赖
just check     # 格式、静态检查、类型检查和单元测试
just data      # 抓取并验证最新行情
just history   # 抓取官方收盘并更新滚动历史
just backfill  # 带随机节流地重建最近 365 天收盘历史
just validate  # 校验待发布的最新行情和历史
just build     # 构建静态网站
just ci        # 执行 Nix 检查
```

数据源：[新浪财经](https://finance.sina.com.cn/)、[巨潮资讯](https://webapi.cninfo.com.cn/)、
[中国金融期货交易所](https://www.cffex.com.cn/zz1000/)。免费公开接口不提供可用性保证；网站
显示数据日期和抓取时间，内容仅供个人研究，不构成投资建议。

本项目以 GPL-3.0 许可证发布。Dividendi 在拉丁文中意为“关于股息的”。
