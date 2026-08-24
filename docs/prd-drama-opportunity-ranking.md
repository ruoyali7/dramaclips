# DramaClips PRD：Drama Opportunity Ranking（后续独立任务）

状态：Backlog，暂不实现；本文件只作为后续实现契约
说明：本任务与 `docs/prd-hook-optimization.md` 分开规划；目标是找出最值得推广的 drama，不负责剪辑和文案优化。

## 目标

基于公开、合规且可追踪的数据，回答：**今天哪些 drama 值得优先投入推广？**

## 后续范围

- 一个可靠的 source adapter 和手动 crawl job。
- social posts 与历史 metric snapshots。
- drama title/alias normalization 和低置信度人工复核。
- viral velocity、engagement、competition、affiliate economics、hook potential 等指标。
- 可解释的 0–100 Opportunity Score 和每日 Top Drama 页面。
- affiliate availability 的人工维护，不自动登录或自动创建 affiliate link。
- 单一来源失败不阻断其他来源；所有 job 尽量幂等。

## 后续实现顺序与 V1 边界

V1 先只做可复现的每日 ranking，不做自动决策或自动发布：

1. 定义 `drama_sources`、`social_posts`、`drama_metric_snapshots` 和 `drama_aliases` 的最小字段，并为每次 crawl 保存 `crawl_run_id`、source、started/finished time、status 和错误摘要。
2. 先接入一个允许使用的 source adapter，并提供手动触发 job；adapter 输出统一的 post/metric DTO，不能直接写排名表。
3. 做 title/alias 归并和低置信度人工复核，再计算 24h/3d/7d 的基础指标。
4. 以固定版本号保存 score 公式、输入窗口、缺失数据处理和每项分数，最后提供 Top Drama 查询和页面。

V1 暂不包含 hashtag intelligence、自动 affiliate link、自动登录/发布、跨平台因果归因或 ML 训练。没有足够数据的 drama 必须显示 `insufficient_data`，不能用看似精确的 0–100 分伪装完整排名。

建议的最小可交付数据关系是：`drama` 作为 canonical entity，`drama_aliases` 负责名称映射，`social_posts` 保存去重后的平台帖子，`drama_metric_snapshots` 保存按 drama/platform/window 的聚合快照，`affiliate_availability` 保存人工维护状态。不要为每个来源建立一套独立的 drama 表。

## Hashtag Intelligence 模块（暂停）

该模块暂时不实现。当前 Hook 只需要根据已有 drama/Hook metadata 自动生成相关 hashtags，不需要外部 hashtag performance 数据：

```text
抓取 social post
→ 保存 post metrics
→ 拆出 hashtags
→ 按 hashtag 聚合表现
→ 计算 drama/genre 相关性与竞争度
→ 为 Hook 生成平台独立 hashtag set
→ 回收 DramaClips 自己的发布结果
```

### 后续再评估的数据记录

每条 social post 保存：

- 原始 hashtag 文本和规范化 hashtag
- platform、post_id、drama_id、crawl time
- views、likes、comments、shares（可用时）
- published_at、creator、caption

聚合层保存每个平台/时间窗口的：

- hashtag 使用量
- average views、median views
- engagement rate
- viral rate（超过同平台/同类型基准的比例）
- drama/genre relevance
- competition score
- source freshness

### 后续再评估的 Hashtag performance score

初始规则：

```text
30% average/median performance
25% recent trend growth
20% viral rate
15% drama/genre relevance
10% competition opportunity
```

不要单纯按照使用量或总 views 排名。`#fyp` 这类高使用量标签如果相关性低、median views 低或转化弱，应被降权。

每个 Hook 的推荐组合：

```text
2 个 broad/high-reach tags
+ 3 个 niche/genre tags
+ 1 个 plot/drama tag
+ 1 个 experimental tag
```

推荐结果必须保留 platform、数据窗口、来源、score breakdown 和 fallback 状态，供 Hook Publish Center 人工修改。

### 开源项目使用策略

可评估以下方向，但不能未经审查直接作为生产依赖：

- `tiktok-semantic-engagement`：参考 caption/hashtag 与 engagement 的可解释分析。
- `Instagram-Analytics-Agent`：参考 hashtag performance dashboard 和聚合视图。
- `HASHET`：参考文本/embedding 到 hashtag 的相关性推荐。
- GitHub hashtag recommendation topic 下的其他项目：仅作为候选算法和 fixture 来源。

采用前必须检查：license、最后维护时间、依赖安全、数据是否来自官方 API、是否绕过平台限制、是否暴露账号凭据。优先提取纯算法，不直接复制未经审计的 crawler 或登录逻辑。

### 数据限制与 fallback

TikTok/Instagram 未必提供完整的公开 hashtag 数据，平台 API 权限和返回字段可能变化。因此：

- 先从已经采集的爆款 social posts 中提取 hashtag，不额外建立独立 crawler。
- 一个来源不可用时继续使用其他来源，并标记 stale/partial。
- 没有外部 performance 数据时，使用相关性 + catalog fallback，但必须明确标识。
- 外部 hashtag performance 只能作为发现信号；DramaClips 自己的 CTR、affiliate clicks 和 revenue 才能验证真实引流。

## 明确不包含

- Hook 剪辑、字幕、caption、cover、CTA，以及 Hook Publish Center 内的文案编辑体验。
- Hashtag extraction、trend crawler、hashtag performance ranking 和平台热门标签分析；这些内容仅保留在本文件的未来评估记录中。
- 自动下载视频、自动发帖、自动创建 affiliate link。
- 大规模分布式爬虫、绕过平台限制的 scraping、ML model training。

## 主要验收（本任务，不含暂停模块）

- 历史快照可用于计算 24h/3d/7d 增长。
- 多个 post 能归并到一个 canonical drama。
- ranking 可显示分项解释、来源链接和数据时间。
- affiliate 信息可人工维护。
- 采集失败可观测且不会使整个 ranking job 失败。
- 每个 score 都能回溯到 source、时间窗口、输入快照和公式版本。
- crawl run 可重跑且幂等；单个 source 失败时其他 source 仍能完成，并显示 `partial`/`stale`。
- Top Drama 页面明确显示数据新鲜度、样本量、缺失字段和人工维护的 affiliate availability。
