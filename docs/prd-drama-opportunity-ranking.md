# DramaClips PRD：Drama Opportunity Ranking（后续独立任务）

状态：Backlog，暂不实现  
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

## Hashtag Intelligence 模块

Hashtag Intelligence 与 social post crawler 同批建设，不单独维护一个重复的数据采集系统：

```text
抓取 social post
→ 保存 post metrics
→ 拆出 hashtags
→ 按 hashtag 聚合表现
→ 计算 drama/genre 相关性与竞争度
→ 为 Hook 生成平台独立 hashtag set
→ 回收 DramaClips 自己的发布结果
```

### 数据记录

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

### Hashtag performance score

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
- Hashtag recommendation 结果在 Hook 内的展示和人工编辑；这些由 Hook 任务负责消费。
- 自动下载视频、自动发帖、自动创建 affiliate link。
- 大规模分布式爬虫、绕过平台限制的 scraping、ML model training。

## 主要验收

- 历史快照可用于计算 24h/3d/7d 增长。
- 多个 post 能归并到一个 canonical drama。
- ranking 可显示分项解释、来源链接和数据时间。
- affiliate 信息可人工维护。
- 采集失败可观测且不会使整个 ranking job 失败。
- hashtag 可从 social post 中提取、聚合并按平台输出可解释的推荐组合。
- Hook 发布记录可以回写实际使用的 hashtag set。
