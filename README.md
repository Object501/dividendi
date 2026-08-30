# dividendi

计算红利股的等效利息。
Dividendi 在拉丁文中是 "of the dividend" 的意思，即“关于股息的”。

## 开发

项目使用 Nix 提供开发工具，支持 `aarch64-darwin`、`aarch64-linux` 和
`x86_64-linux`：

```sh
nix develop
just check
nix flake check
```

## 标的配置

期货品种、对应指数和股票清单统一配置在
[`config/instruments.json`](config/instruments.json)。网页和每日数据下载程序均读取该文件，
代码中不另行维护标的清单。
