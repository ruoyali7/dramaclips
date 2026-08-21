# DramaClips Backend Architecture & Debugging Runbook

本文件是 DramaClips 的 backend training 和日常排障手册。目标不是只解释“代码在哪”，而是让你遇到一个故障时，能按照固定顺序回答：

1. 请求从哪里进入？
2. 谁负责认证和参数校验？
3. 数据写入了哪里？
4. 哪个外部服务被调用？
5. 状态如何回写？
6. 哪一个日志、表、对象或页面可以证明问题发生在哪一步？

## 1. 先建立整体心智模型

项目是一个 Next.js modular monolith，加一个独立的 Python long-running worker：

```text
Browser
  ├─ Public pages: Next.js/Vercel ── Supabase REST/Postgres
  ├─ Admin pages: Next.js/Vercel ──── Supabase REST/Postgres
  │       ├─ signed PUT ─────────── Cloudflare R2
  │       ├─ hook job queue ──────── Railway hook worker
  │       └─ publish queue ───────── Railway hook/publish worker
  └─ Redirect/event routes: Next.js/Vercel ── Supabase analytics

R2 stores video files; Supabase stores metadata, queues, state and audit-like records.
Vercel request handlers create/read/update work. They must not perform long video rendering.
Railway worker performs FFmpeg, Whisper, scene detection and Yixiaoer CLI operations.
```

### 部署边界

| 部件 | 代码位置 | 典型部署位置 | 负责什么 | 不负责什么 |
|---|---|---|---|---|
| Web/API | `app/`, `components/`, `lib/` | Vercel/Next.js | 页面、API、认证、短请求、队列状态 | 长时间转码、常驻进程 |
| Database | `supabase/migrations/` | Supabase Postgres + REST | metadata、job、publish 状态、analytics | 视频二进制 |
| Media storage | `lib/admin/r2.ts` | Cloudflare R2 | 原片、cover、hook draft、已保存 hook | 业务状态机 |
| Worker | `worker/hook_worker/main.py` | Railway Docker service | hook 分析/渲染、Yixiaoer 上传发布 | 管理员 UI |
| Optional clipper | `lib/admin/vizard.ts`, `/admin/vizard` | Vizard API | 第三方批量剪辑 | 主 hook queue |
| Publish provider | `lib/admin/yixiaoer.ts` 或 worker 中 `yxer` | Yixiaoer cloud/CLI | 社媒账号与平台发布 | Drama metadata |
| Local fallback | `lib/admin/draft-repository.ts` 等 | 本地进程 | 没有 Supabase 时的开发 fallback | 不能代表生产数据 |

线上到底是 Vercel 哪个 project、Railway 哪个 service、Supabase 哪个 project，不能仅靠 git 完全确认；这些应以各平台 dashboard 和当前环境变量为准。代码已确认 Railway 使用 `worker/Dockerfile` 和 `worker/railway.toml`，而 Web 侧没有单独的 `vercel.json`。

## 2. 环境变量：先分清谁需要什么

完整变量名见 `.env.example`。不要把真实值写进文档、日志或 commit。

### Web/Vercel 必需分组

- `NEXT_PUBLIC_SITE_URL`：站点 URL。
- `NEXT_PUBLIC_SUPABASE_URL`：Supabase REST endpoint；名称带 `NEXT_PUBLIC` 不代表 service role key 可以暴露。
- `SUPABASE_SERVICE_ROLE_KEY`：服务端访问 Supabase；绝不发送给浏览器。
- `ADMIN_DEMO_PASSWORD`、`ADMIN_SESSION_TOKEN`：当前单 operator admin 登录。
- `CPS_URL_ENCRYPTION_KEY`：CPS destination 加密。
- `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`、`R2_PUBLIC_BASE_URL`：签发 R2 上传 URL、server-side copy/list/delete。
- `VIZARD_API_KEY`：可选 Vizard 集成。
- `YIXIAOER_API_KEY` 或 Supabase runtime secret `yixiaoer_api_key`：发布账号操作。
- `HOOK_WORKER_TOKEN`：Web 与 Railway worker 的共享 internal API token。

### Railway 必需分组

- `CONTROL_PLANE_URL`：线上 Next.js URL，worker 用它调用 internal endpoints。
- `HOOK_WORKER_TOKEN`：必须和 Web 一致。
- `WHISPER_MODEL`、`FFMPEG_PATH`/系统 ffmpeg、`FFPROBE_PATH`/系统 ffprobe。
- `WORK_DIR`：临时下载和转码目录。
- `YIXIAOER_API_KEY`：worker 调用 `yxer` 时使用；实际发布 channel 由 `YIXIAOER_PUBLISH_CHANNEL` 控制。
- `X-Vercel-Protection-Bypass` 对应的 bypass secret（如果 Vercel protection 阻止 Railway 回调）。

### 变量故障的第一步

在目标平台检查“变量是否存在、值是否属于同一个环境、最近部署是否包含新变量”。不要在日志中打印完整 secret。只打印布尔值，例如 `Boolean(process.env.R2_SECRET_ACCESS_KEY)`。

## 3. Web 请求的共同入口与认证

`middleware.ts` 匹配 `/admin/:path*` 和 `/api/admin/:path*`。除了登录路由，必须带 cookie `dc_admin`，且值等于 `ADMIN_SESSION_TOKEN`，否则重定向到 `/admin/login`。

因此：

- 页面返回 302 到登录页：先查 cookie、`ADMIN_SESSION_TOKEN`、middleware matcher。
- API 返回 HTML 登录页而不是 JSON：通常是 admin cookie 丢失或 API 被 middleware 重定向。
- `/api/internal/*` 不经过 admin middleware，但通过 `x-hook-worker-token` 或 `Authorization: Bearer ...` 校验 `HOOK_WORKER_TOKEN`。
- `SUPABASE_SERVICE_ROLE_KEY` 只在 server-side `fetch` 中使用；如果在 browser bundle 或 response 出现，这是严重安全事故，应立即轮换。

推荐的最小复现：

```bash
curl -i http://localhost:3000/admin/publish
curl -i -X POST http://localhost:3000/api/internal/hook-worker/lease \
  -H "content-type: application/json" \
  -H "x-hook-worker-token: $HOOK_WORKER_TOKEN" \
  --data '{"workerId":"debug-local","leaseSeconds":60}'
```

## 4. 数据层：Supabase 是生产 system of record

### Repository mode

`lib/admin/repository.ts` 根据 `repositoryMode()` 选择：

- 配置了真实 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`：调用 `lib/admin/supabase-repository.ts`。
- 没有配置：使用本地 repository，例如 `draft-repository.ts`；这只适合开发，不是线上数据。

这是非常重要的 debug 分叉：本地“能看到数据”不代表 Supabase 已写入。

### 主要表及其作用

| 表 | 用途 | 关键状态/关联 |
|---|---|---|
| `drama_bundles` | drama metadata、episode URL、draft/published | `status`, `episodes`, `published_at` |
| `hook_generation_jobs` | hook 异步任务 | lease、progress、status、error |
| `hook_job_attempts` | hook attempt 历史 | worker、attempt、结果 |
| `hook_candidates` | worker 产出的候选片段 | rank、time ranges、score、draft URL |
| `hook_clips` | 人工批准后可发布的 durable hook | `status=saved`, `object_key`, `video_url` |
| `publish_packages` | 原片/hook/upload 的发布包 | video source、platforms、provider 状态 |
| `publish_platform_attempts` | 每个平台的 publish/reconcile 尝试 | provider request/post id、state |
| `short_links`, `tracking_events` | 短链和访问分析 | code、source/campaign、时间 |
| `admin_runtime_secrets` | 可轮换的运行时 secret | 当前主要用于 Yixiaoer key |

Migration 必须按文件名时间顺序执行。新环境至少检查 `supabase/migrations/*.sql` 是否全部已应用，尤其是 hook、Yixiaoer queue、scheduled queue、reconciliation 相关 migration。

### 常用只读检查

可在 Supabase SQL editor 执行，生产环境只读排查不要随意 UPDATE/DELETE：

```sql
select id, slug, status, published_at, jsonb_array_length(episodes) as episode_count
from public.drama_bundles order by created_at desc limit 20;

select id, status, progress, lease_owner, lease_expires_at, error_category, error_message
from public.hook_generation_jobs order by created_at desc limit 20;

select id, status, video_kind, video_label, yixiaoer_action, yixiaoer_results
from public.publish_packages order by created_at desc limit 20;
```

## 5. 内容 ingestion：从 Add Drama 到 public watch

```text
/admin/dramas/new
  → /api/admin/uploads/presign
  → browser PUT directly to R2
  → /api/admin/dramas (save draft; episode URLs only)
  → /api/admin/dramas/[id]/publish
  → drama_bundles.status = published
  → /watch/[slug] reads catalog
```

关键事实：视频不会经过 Vercel request body；浏览器拿短期 signed PUT URL 直接上传 R2。`lib/admin/r2.ts` 默认签名有效期 900 秒，单视频上限 10 GB。R2 object 通常位于 `dramas/{slug}/...`；social drafts 在 `dramas/{slug}/social/drafts/`，批准 hook 在 `dramas/{slug}/social/hooks/`。

### ingestion 故障定位

1. 没拿到 presigned URL：看 `R2_*` 是否齐全、slug 是否符合 kebab-case、文件 MIME/大小是否通过。
2. URL 返回但 PUT 失败：查 R2 bucket CORS、URL 是否过期、`Content-Type` 是否与签名请求一致、浏览器 origin 是否被允许。
3. PUT 成功但保存失败：检查 `publicUrl` 是否回传、drama schema、Supabase `drama_bundles` 插入错误。
4. 保存成功但 public page 404：检查 status 是否 `published`、slug 是否一致、catalog 是否只查询 published、部署是否是最新版本。
5. 播放失败：先用浏览器直接打开 episode `videoUrl`，再检查 R2 public domain、CORS、Range request 和 object 是否存在。

## 6. Hook pipeline：从 R2 原片到可审核 hook

旧的同步接口已明确返回 410：`/api/admin/hooks/generate` 与 legacy draft save 不再是正确入口。当前流程：

```text
/admin/hooks
  → POST /api/admin/hooks/jobs
  → hook_generation_jobs queued
  → Railway POST /api/internal/hook-worker/lease
  → worker downloads R2 URLs
  → ffprobe → Faster-Whisper → PySceneDetect → scoring
  → FFmpeg 1080x1920 H.264/AAC render + frame-zero QA
  → POST /api/internal/hook-worker/uploads
  → PUT draft MP4 to R2/social/drafts
  → POST /api/internal/hook-worker/jobs/[id]
  → review_ready / no_result / failed
  → human approves candidate
  → promote draft to R2/social/hooks + insert hook_clips
```

worker 的实际处理阶段在 `worker/hook_worker/main.py`：`downloading → transcribing → analyzing → rendering → review_ready`。lease、heartbeat 和 owner 防止两个 worker 同时处理同一个 job。worker 临时文件在 `WORK_DIR`，不是 Supabase。

### Hook 故障定位顺序

1. UI 创建失败：看请求 payload 是否包含 drama UUID、1–5 episode numbers、settings；确认 drama 已 published 且 episode URL 可访问。
2. 一直 queued：查询 `hook_generation_jobs`；如果没有 lease/heartbeat，查 Railway service 是否 running、`CONTROL_PLANE_URL`、token。
3. downloading 失败：从 Railway 环境用 `curl -I` 检查 R2 public URL；检查源视频是否仍存在、HTTPS、超时和 content length。
4. transcribing/analyzing 失败：查 worker stdout、Whisper model 是否下载成功、内存/CPU、ffprobe/scenedetect 输入；不要只看 UI 的 generic failed。
5. rendering 失败：检查 ffmpeg stderr、字体路径、输入音轨；输出必须是 1080×1920，且 frame zero、duration、audio QA 全部通过。
6. review_ready 但看不到 candidate：检查 `hook_candidates.job_id`、job status、Supabase migration、draft URL 是否为有效 R2 URL。
7. 保存后 Publish Center 没有 hook：检查 `hook_clips.status=saved`、`drama_slug`、`object_key` 和 `video_url`，以及前端是否只查询 saved clips。

## 7. Publish Center 与 Yixiaoer queue

Publish Center 允许选择三类 source：`original`、`hook`、`upload`。它先创建/更新 `publish_packages`，再将平台操作 enqueue，而不是在浏览器请求中直接完成长发布。

```text
/admin/publish
  → create publish package
  → choose platforms/accounts and copy
  → validate / dry-run
  → explicit publish confirmation
  → POST /api/admin/publish-packages/[id]/yixiaoer
  → publish_packages queue fields
  → Railway lease /api/internal/publish-worker/lease
  → download R2 video, upload to Yixiaoer cloud
  → yxer validate/dry-run/publish
  → provider request ID and result written back
  → published / failed / outcome_unknown
```

不要自动 retry `outcome_unknown`：provider 可能已经发布成功，盲目重试会造成重复帖子。先用 `reconcile` 查询 provider；只有 confirmed `failed` 才允许 retry。`publish_platform_attempts` 是按平台查 duplicate、request ID 和状态的首选位置。

### Publish 故障定位

- package 不存在：查创建 API response 和 `publish_packages`。
- 不能 publish：通常是未完成 upload/validate/dry-run、没有 platform account、package 已 locked、已有 `yixiaoer_action`。
- 一直 publishing：查 Railway lease、worker heartbeat、`yixiaoer_action`、`yixiaoer_results._operation`。
- upload 失败：先下载 R2 video 到 worker 的临时目录验证大小/可读性，再查 Yixiaoer key/channel。
- 平台单独失败：只看该 platform result；不要把整包当成完全失败。
- `outcome_unknown`：立即停止 retry，运行 reconcile，记录 provider request/post ID。
- CSV 需要 fallback：使用 `/api/admin/publish-packages/latest/csv`，但它是导出，不等同于 provider 已发布。

## 8. Public redirect、tracking 和 analytics

public redirect 相关入口包括 `/go/[slug]`、`/x/[code]`、`/l/[slug]` 和 `/api/events`。redirect 的正确性和 analytics 的可用性要分开排查：analytics 降级不应阻断 redirect/playback。

```text
visitor → short link/redirect route
  → resolve route + drama + encrypted CPS destination
  → record tracking event/click (best effort)
  → redirect to destination or safe fallback
```

如果 redirect 失败：先直接验证 route/drama/destination 状态和 host；再检查解密 key 与 encrypted value；最后看 event insert 是否把主路径拖慢。永远不要通过 public JSON endpoint 返回解密后的 CPS URL。

## 9. 标准 debug protocol

### 第一步：定义故障边界

记录：URL、时间（含 timezone）、drama slug、episode、job/package UUID、平台、浏览器 response status、worker status。没有 ID 时先从 Supabase 按时间查，不要靠猜。

### 第二步：确定属于哪一层

```text
页面/HTTP 失败？      → middleware、route handler、Vercel logs
数据不存在/状态错？   → Supabase table、migration、repository mode
视频不存在/打不开？   → R2 object URL、CORS、Range、权限
任务不动？            → Railway worker、lease、heartbeat、token
第三方失败？          → provider key/account/request ID/result
```

### 第三步：用最短链路复现

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm test
npm run build
npm run dev
```

本地只读检查：

```bash
git status --short
git diff --check
ffprobe -v error -show_format -show_streams /path/to/video.mp4
curl -I 'https://your-r2-public-domain/dramas/slug/episode.mp4'
```

不要用 production secret 在不受控的本地日志中运行；不要为了验证而直接删除 queue row 或 R2 object。

### 第四步：按证据推进

每一步都写下“预期证据”和“实际证据”：

| 检查点 | 成功证据 |
|---|---|
| middleware | admin 页面正常，API 返回 JSON 而不是 302/HTML |
| DB | 对应 row 存在且状态符合流程 |
| R2 | URL 返回 200/206，视频 metadata 可被 ffprobe 读取 |
| lease | worker owner、heartbeat、progress 在更新 |
| render | 1080×1920、H.264/AAC、frame zero QA 通过 |
| provider | request/post ID 明确，最终状态不是 unknown |
| UI | 刷新后仍显示同一 durable state |

## 10. 部署与 release checklist

### Web

1. 确认 git diff 只包含本次任务。
2. `git diff --check`。
3. `npm run typecheck && npm test && npm run build`。
4. 在 Vercel 确认 production env、Supabase URL、R2 public URL、worker token。
5. 确认所需 Supabase migrations 已应用。
6. 部署后做 smoke test：登录、public watch、创建 hook job、读取 publish package、tracking redirect。

### Railway

1. 确认 `worker/Dockerfile` 能安装 ffmpeg、node/npm、`@yixiaoermail/cli` 和 Python requirements。
2. 确认 `CONTROL_PLANE_URL` 指向当前 production Web，不是旧 preview URL。
3. 确认 `HOOK_WORKER_TOKEN` 两端完全一致。
4. 检查 Railway logs 中 worker 启动、lease、heartbeat、错误 stack trace。
5. 用一个小视频做完整 hook smoke test，再测试 publish validate/dry-run；不要直接用 live publish 做首次验证。

### 回滚原则

先回滚 Web 代码，再判断是否需要回滚 migration。不要随便逆向删除 migration 或清理 queue；数据库状态和外部 provider 状态可能已经发生，应该通过 reconcile/repair 处理。

## 11. 常见错误的根因速查

| 症状 | 高概率根因 | 首查位置 |
|---|---|---|
| R2 CLI `Invalid endpoint: https://.r2...` | `R2_ACCOUNT_ID` 未注入 | 平台 env；不要据此判断媒体不存在 |
| Admin API 返回 302 | `dc_admin`/session token 不匹配 | `middleware.ts`、cookie、Vercel env |
| hook legacy endpoint 410 | 正常设计，已迁移到 async jobs | `/api/admin/hooks/jobs` |
| job 一直 queued | worker 未运行、control plane 错、token 错 | Supabase job + Railway logs |
| worker 401 | 两端 `HOOK_WORKER_TOKEN` 不一致 | internal route + Railway env |
| hook 没有结果 | 质量阈值未通过，可能是合法 `no_result` | job error/status、候选 score |
| 上传后视频黑屏/比例错 | ffmpeg input/filter/QA 失败 | worker stderr、candidate `qa_results` |
| publish 重复风险 | 未处理 `outcome_unknown` 就 retry | package results、attempts、provider console |
| 本地有数据线上没有 | repository 走 local fallback | `repositoryMode()` 和 Supabase env |
| analytics 数字不更新 | tracking migration/insert/query 问题 | `tracking_events`、`/api/events` |

## 12. SDE training：如何读这个项目

建议按以下顺序学习，而不是从任意 component 开始：

1. 读 `README.md` 和本文件，先画出系统边界。
2. 读 `middleware.ts`，理解 auth boundary。
3. 选一条 vertical slice：`new drama → R2 → drama_bundles → watch`。
4. 再读 `hooks/jobs`，理解 queue、lease、heartbeat 和 worker callback。
5. 最后读 `publish_packages`，重点理解 idempotency、provider outcome unknown 和 reconcile。
6. 每读一条链路，写一个“输入、状态、输出、失败点、恢复动作”表。
7. 修改前先写可验证成功条件；修改后运行最小相关测试，再运行 typecheck/test/build。

代码导航入口：

- Web routes：`app/api/**/route.ts`
- Admin UI：`components/admin/`、`app/admin/`
- Domain repositories：`lib/admin/`
- DB contract：`supabase/migrations/`
- Worker runtime：`worker/hook_worker/main.py`
- Worker deployment：`worker/Dockerfile`、`worker/railway.toml`
- Existing product decisions：`docs/unified-admin.md`、`docs/phase-3-hook-production-prd.md`

最后的判断原则：先找 durable ID 和状态记录，再看日志；先区分“没有被执行”和“执行后失败”；先 reconcile 外部 provider，再 retry；先证明当前部署/环境，再修改代码。
