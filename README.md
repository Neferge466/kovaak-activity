# KovaaK Activity

类似 GitHub Contributions 的 KovaaK 训练档案。React 根据静态 JSON 渲染交互热力图，GitHub Actions 采集线上成绩，GitHub Pages 展示页面。可选本地 Stats 同步，不需要自己的服务器或数据库。

支持中文 / English。默认页面读取真实记录，`?demo=1` 是单独的模拟页面。

## 本地预览

使用 Node.js 24：

```sh
npm ci
npm run dev
```

导入数据后刷新页面。浏览器只读取静态 JSON，不直接请求 KovaaK。`public/data/` 在启动和构建前自动生成。

## 玩家和线上抓取配置

配置文件：`config/players.json`。

```json
{
  "tracking": { "scoreHistory": true, "concurrency": 3 },
  "players": [{ "id": "main", "steamId": "YOUR_STEAM_ID", "username": "YOUR_KOVAAK_USERNAME", "timezone": "Asia/Shanghai" }]
}
```

| 选项 | 含义 |
| --- | --- |
| `id` | 仓库内部玩家标识；换账号或时区时使用新标识 |
| `steamId` | 17 位 Steam ID，用于核对线上身份 |
| `username` | KovaaK 网站用户名，不是 Steam 昵称 |
| `timezone` | 每日记录归属时区 |
| `tracking.scoreHistory` | 是否采集逐次成绩，默认开启 |
| `tracking.concurrency` | 请求并发数，1–8，默认 3 |
| 玩家条目中的 `scoreScenarios` | 可选场景名数组；省略则查询所有已发现场景 |

场景从线上场景列表、PB 动态、已保存成绩及本地历史中发现。未被这些来源发现的场景暂时无法自动查询。多个玩家独立保存数据，页面可用 `?player=main` 切换。

工作流计划每 **10 分钟**运行一次，分钟为 `7,17,27,37,47,57`，配置位于 `.github/workflows/update-data.yml`。GitHub 定时任务可能延迟，周期变更须推送到默认分支才能生效。

## 本地同步配置

模板：`config/local-sync.example.json`。个人配置：`config/local-sync.json`，已被 Git 忽略。

```powershell
Copy-Item config/local-sync.example.json config/local-sync.json
```

编辑个人配置：

```json
{
  "playerId": "main",
  "statsFolder": "C:/Program Files (x86)/Steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/stats",
  "intervalSeconds": 600,
  "github": { "enabled": false, "repository": "YOUR_GITHUB_USERNAME/kovaak-activity", "branch": "main" }
}
```

| 选项 | 可配置内容 |
| --- | --- |
| `playerId` | 对应 `players.json` 中的 `id` |
| `statsFolder` | 本机 Stats 文件夹，支持不同 Steam 安装路径 |
| `intervalSeconds` | 连续同步间隔，默认 600 秒，最低 60 秒 |
| `github.enabled` | 自动上传开关；默认 `false`，只导入本地 |
| `github.repository` | 目标仓库，格式为 `拥有者/仓库名` |
| `github.branch` | 已存在的目标分支 |

当前导入器支持在 **Asia/Shanghai（UTC+8）**环境生成的 CSV，按文件名时间归属日期。其他来源时区需要扩展导入器。

## 导入和上传流程

```text
读取全部 Stats CSV
→ 校验场景、成绩、完成时间和开始时间
→ 与此前记录合并、去重
→ 保存 data/players/{id}/local-history.json
→ 可选：读取 GitHub 历史并合并
→ 仅更新该玩家的 local-history.json
→ Actions 构建 → Pages 显示
```

原始游戏文件不会修改。重复扫描补回程序停止期间生成的记录，已导入记录不会因 CSV 后来被删除而丢失。解析失败停止本次导入；上传失败保留本地记录供重试。没有新记录时不创建上传提交。

| 命令 | 行为 |
| --- | --- |
| `npm run sync:local` | 导入全部 Stats，按配置决定是否上传 |
| `npm run sync:local -- --dry-run` | 展示将上传的字段和记录数，不认证、不上传 |
| `npm run sync:local -- --upload` | 显式上传整理后的全部历史 |
| `npm run sync:local -- --watch` | 按配置间隔持续扫描，Ctrl+C 停止 |
| `npm run sync:local -- --watch --upload` | 持续扫描并上传 |
| `npm run sync:local -- --config config/other.local.json` | 使用指定配置 |

`--upload` 覆盖配置中的关闭状态；`--dry-run` 始终禁止上传。`--watch` 是周期扫描进程，需要电脑和程序运行，不是已安装的 Windows 服务。

认证使用本机 Git Credential Manager 的 GitHub 登录，或本机 `GITHUB_TOKEN` 环境变量，需具备目标仓库 Contents 写入权限。不要把令牌填进配置。上传使用 GitHub 文件 API，不暂存其他工作文件，不强制推送。文件版本冲突会重读、合并并重试。仓库须先包含支持此数据格式的代码与工作流，上传后的提交才能正确构建。

## 隐私和公开范围

公开仓库中的训练数据会公开，不能称为完全匿名或完全私密。

上传文件使用字段白名单：

- 元数据：格式版本、Steam ID、数据来源、覆盖状态、导入时间、记录时区。
- 每次训练：场景标识、名称、成绩、完成时间、可用时的精确开始时间。

不上传本机用户名、磁盘路径、邮箱、密码、API 令牌、原始 CSV、设备或灵敏度参数。个人同步配置被 Git 忽略。上传器再次清理额外字段，认证信息只在本机进程中用于请求，不写入上传内容或日志。

Steam ID、场景及精确训练时段会公开账号和训练习惯，这是当前档案主动展示的数据。不希望公开时，保持 `github.enabled: false` 并只在本地查看。不要向公开仓库推送自己不愿公开的记录。

## 数据口径和去重

热力图每格是 **一天**，曲线每点是 **周一至周日合计**。两者使用相同每日数据和选中年份，年度 Runs 合计相同。跨年周只统计选中年份内日期；当前周统计到当前日期。无记录日期保持未知，不补零。

重复 API 响应按场景和完成时间去重；同分不同时间的训练分别计数。精确 Challenge Start 用于跨来源匹配，保留本地更精细的分数，避免小数截断和上传延迟导致重复。旧线上记录没有可靠开始时间时，只追加到本地导入时间之后。

实测成绩接口多数场景只返回最后 10 条，尝试分页没有扩大范围。55 秒一次时，10 分钟内可能完成 11 次，仍可能遗漏。满窗口与已有历史完全无重叠时记录“可能缺失”，不是精确漏记数量。

线上计数与逐次记录不能直接相加，重叠时取较大的已知下限。首次累计快照只作基线，跨日增量单独保存，计数回退不减去真实记录。训练时长暂不可用，不把 Fight Time 当作完整 Run 时长。百分比表示近期首条与最新可读成绩的变化，不是终身 PB 提升。

## GitHub 部署

1. 使用模板 / Fork / Clone，填写玩家配置并推送项目。
2. Settings → Pages → Source 选择 GitHub Actions。
3. Settings → Secrets and variables → Actions → Variables 添加 `TRACKING_ENABLED=true`。
4. 运行一次 Update activity data 和 Deploy Pages。

标准项目地址：`https://YOUR_GITHUB_USERNAME.github.io/kovaak-activity/`。

## 验证

```sh
npm run check:polling
npm run check:tracking
npm run check:calendar
npm run build
```

Mock 不请求真实接口、不覆盖真实历史。模拟 30 次训练，线上轮询保留 29 条，重复响应新增 0，合并本地后为 30 条。测试覆盖上传字段白名单、远端历史保留、并发冲突、身份校验和日历汇总一致性。
