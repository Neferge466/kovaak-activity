# KovaaK Activity

A GitHub-style KovaaK training activity profile. React renders the interactive heatmap from static JSON. GitHub Actions samples public player counters; GitHub Pages hosts the site. No server, database, API proxy, or browser-to-KovaaK requests.

## Current instance

- KovaaK username: **NEFOR**
- Steam ID: `76561199196193444`
- Timezone: `Asia/Shanghai`
- First snapshot: see `data/players/main/state.json`

The default page is the real tracked profile. `?demo=1` opens the separate mock UI. English / 简体中文 switching covers dates, tooltips, descriptions, and empty states; the browser remembers the selection. Scenario names stay unchanged.

## GitHub setup / GitHub 设置

1. Push this repository to GitHub. For free GitHub Pages hosting, use a **public** repository.
2. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Under **Settings → Secrets and variables → Actions → Variables**, create repository variable **`TRACKING_ENABLED`** with value **`true`**. This opt-in prevents template/fork instances from automatically sampling the original configured player.
4. Open **Actions → Deploy Pages → Run workflow** to publish the current snapshot.
5. Open **Actions → Update activity data → Run workflow** once to check that fetching and saving work in GitHub's environment. Thereafter the enabled schedule runs at minute 17 of each hour.

中文：把 Pages 的发布来源设为 GitHub Actions，添加仓库变量 `TRACKING_ENABLED=true`，然后手动运行一次部署和数据更新工作流。抓取使用公开接口，不需要账号密码、Steam API Key 或个人访问令牌。

The workflow declares the required token permissions itself. Repository/organization policies or branch protection may still restrict bot commits or deployment. If a run is rejected, inspect that specific error; do not add a personal token by default.

This instance's expected URL is `https://neferge466.github.io/kovaak-activity/` **after** Pages is enabled and deployment succeeds. It is not live merely because files have been pushed.

GitHub schedules can be delayed or dropped and are not exact hourly timers. Public repositories with no activity for 60 days can have schedules disabled. Fetch failures leave the latest valid tracking state intact. A scheduled data update explicitly calls the deployment workflow: bot commits made with `GITHUB_TOKEN` do not independently trigger `push` workflows.

## Use as a template

Use Template / Fork / Clone, then edit `config/players.json`:

```json
{
  "players": [
    {
      "id": "main",
      "steamId": "76561199196193444",
      "username": "NEFOR",
      "timezone": "Asia/Shanghai"
    }
  ]
}
```

Currently **both Steam ID and KovaaK website username are needed**: the tested public profile endpoint looks up usernames. The fetcher verifies the returned Steam ID before saving anything. Steam-ID-only setup remains a future improvement, not a supported promise.

Use a new `id` when switching to another player or timezone, so the old history cannot be mixed into the new profile. Multiple entries are supported; each gets separate tracking state and static data. `?player=main` selects a player, and the selector appears when more than one is configured. Template maintainers may enable **Settings → General → Template repository** as an optional convenience.

## What the data means

The verified anonymous endpoints are:

- `/user/profile/by-username?username=…`: identity and reported cumulative Scenario Plays
- `/user/scenario/total-play?username=…&page=0&max=100&sort_param=count`: per-scenario cumulative Plays; all pages are fetched and totals validated
- `/user/activity/recent?username=…`: recent reported PB events, not a complete Run history

The single-scenario recent-score endpoint returned `401` without authentication. No complete run log or reliable training duration was obtained. The integration intentionally uses no login credentials.

**Reported Plays** are KovaaK's public counters; coverage of offline, unsubmitted, or otherwise missing game runs is not guaranteed. **Sampled Plays** are nonnegative counter changes after our baseline, not lifetime counters assigned to today. These are derived from real snapshots, not estimated training minutes.

- First snapshot creates a baseline; historical days remain unknown.
- Same-local-day differences are assigned to that date as a **lower bound**, with partial coverage.
- Cross-day differences remain in the interval ledger and aggregate sampled total, but are excluded from daily cells and scenario focus. We cannot determine which date they belong to.
- Zero change over a sampled interval does not prove zero training across the whole day; these cells retain the unknown pattern.
- Missing weeks are gaps in the trend, not interpolated or fabricated zero weeks.
- Counter rollback is excluded and marked; tracking resumes from the new baseline.
- Scenario focus uses recent counter differences, never lifetime Plays mislabeled as last-month practice.
- Recent Progress currently displays latest reported PB events and scores. It does not invent improvement percentages or sparklines.
- Training minutes, peak hours, and true daily streaks remain unavailable until suitable timestamped data is imported or discovered.

Data authenticity takes priority over filling every module. Local Stats/performance import and README SVG embedding are future work.

## Local development

Use Node.js **24**:

```sh
npm ci
npm run dev
```

Update the real snapshot and rebuild the static JSON locally:

```sh
npm run update:data
node scripts/prepare-data.mjs
```

The browser never fetches KovaaK. `prepare-data` runs before development/build, generates `public/data/`, and Vite copies that data into `dist/`. A development server already running can serve freshly regenerated data after refresh.

```sh
npm run check:tracking
npm run check:calendar
npm run build
npm run preview
```

`check:tracking` checks baseline handling, identity verification, Shanghai midnight, outages, rollbacks, invalid counters, PB filtering, and scenario differences. Calendar checks cover leap years, alignment, thresholds, and weekly aggregation.

## Files

- `config/players.json`: player identities and timezones
- `data/players/{id}/state.json`: authoritative snapshot/interval/PB ledger
- `profile.json`, `latest.json`, `activity-{year}.json`: convenient derived projections
- `scripts/update-data.mjs`: public API fetching, pagination, validation, and safe snapshot updates
- `scripts/prepare-data.mjs`: static JSON generation
- `src/Entry.tsx`: static manifest/player loader and separate demo route
- `src/components/OnlineProfile.tsx`: truthful online profile
- `src/components/ActivityHeatmap.tsx`: SVG-free DOM heatmap with real interactive cells
- `.github/workflows/update-data.yml`: opt-in hourly sampling, commits, and explicit deployment
- `.github/workflows/deploy.yml`: validation, build, and Pages deployment
- `images/img.png`: design reference, not a website background

Vite uses relative asset paths for GitHub Pages repository subpaths. Generated `public/data/`, dependencies, build artifacts, and API research dumps are ignored; real tracking history is versioned.

## References

- [KovaaK FAQ: public endpoints and local files](https://kovaaks.com/kovaaks/faq)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub workflow triggering rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
