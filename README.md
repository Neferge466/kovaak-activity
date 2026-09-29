# KovaaK Activity

GitHub Contributions 风格的 KovaaK 训练档案，展示训练活动、每周趋势、常练场景和成绩变化。支持中文 / English。

React + TypeScript + Vite，使用 GitHub Actions 更新数据，GitHub Pages 托管页面。

## 本地运行

需要 Node.js 24。

```sh
npm ci
npm run dev
```

`?demo=1` 查看模拟数据。

## 玩家配置

编辑 `config/players.json`，填写 Steam ID、KovaaK 网站用户名和时区。支持多个玩家，使用 `?player=main` 切换。

线上成绩每 10 分钟采集一次。热力图按天显示，趋势曲线按周汇总。

## 本地 Stats 同步

```powershell
Copy-Item config/local-sync.example.json config/local-sync.json
```

编辑 `config/local-sync.json`：

| 选项 | 用途 |
| --- | --- |
| `playerId` | 对应玩家配置中的 `id` |
| `statsFolder` | KovaaK Stats 文件夹 |
| `intervalSeconds` | 同步间隔，默认 600 秒 |
| `github.enabled` | 是否自动上传，默认关闭 |
| `github.repository` | GitHub 仓库，格式 `拥有者/仓库名` |
| `github.branch` | 目标分支，默认 `main` |

```sh
npm run sync:local                       # 导入本地记录
npm run sync:local -- --dry-run           # 预览上传内容
npm run sync:local -- --upload            # 导入并上传
npm run sync:local -- --watch --upload    # 持续同步，Ctrl+C 停止
```

同步流程：读取 CSV → 合并去重 → 保存 JSON → 上传 GitHub → Actions 构建 → Pages 更新。

当前本地导入支持 UTC+8 时间。上传使用本机 Git Credential Manager 登录，或 `GITHUB_TOKEN` 环境变量。

## GitHub 部署

1. 创建自己的仓库，修改玩家配置并推送代码。
2. Settings → Pages → Source 选择 **GitHub Actions**。
3. 在仓库 Actions Variables 中添加 `TRACKING_ENABLED=true`。
4. 运行一次 **Update activity data** 和 **Deploy Pages** 工作流。
