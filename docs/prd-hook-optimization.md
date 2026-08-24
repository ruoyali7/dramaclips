# DramaClips PRD：Hook 内容与发布素材优化

状态：Draft，等待实现批准；实现时以现有 Phase 3 Hook workflow 为基线
关联 branch：`codex/drama-opportunity-hook-prd`

## 1. 目标

提升现有短剧推广视频的点击率、继续观看意愿和 affiliate 转化能力。优化对象不是单一 AI 选片，而是完整的 Hook package：

```text
选段 → 剪辑边界 → 前 1–3 秒 → 字幕/屏幕文案 → cover → caption → hashtag → CTA → 发布前审阅
```

核心原则：让新用户快速理解冲突，同时留下足够的信息缺口促使继续观看；不要把剧情完整结局剪完，也不要为了“刺激”牺牲字幕可读性、平台安全或发布稳定性。

## 2. 与另一个任务的边界

本任务只回答：**给定 DramaClips 已有 drama/episode 素材，怎样做出更吸引人的推广 Hook？**

另一个独立任务回答：**今天最值得推广哪部 drama？** 它涉及外部趋势采集、历史快照、competition、affiliate opportunity ranking，本阶段不实现、不作为 Hook 交付前置条件。

本任务不重写现有上传、R2、Supabase、hook worker、FFmpeg/Vizard、发布中心和 analytics 链路，而是在其上增加候选评分、素材生成和人工审阅能力。

## 3. 当前问题

- 开头可能从对白中间开始，用户没有上下文。
- 片段常包含片头、等待、走路、长停顿或无效反应。
- 结尾可能提前结束一句话，或直接把冲突和结局都透露出来。
- 只按 episode 机械选一个 Hook，弱片段也被迫产出。
- 选出的片段有戏剧性，但不一定能让新观众想继续看。
- 字幕、标题、caption、hashtag、cover 和 CTA 之间没有统一的转化意图。
- 社交平台适配不足：文字可能挡脸、超出安全区、过长或使用低价值泛标签。

## 4. V1 范围

### 4.1 Hook 候选与剪辑

- 以整部 drama 为候选池，不要求每个 episode 产出一个 Hook。
- 每个候选保留 episode、rough start/end、最终 start/end、候选理由和状态。
- 生成多个候选后全局排序；允许多个候选来自同一 episode，弱 episode 可以没有结果。
- V1 默认最多输出 2 个候选，与现有 `hook_candidates.rank` 和 Phase 3 审阅流程一致；后续扩大数量必须先扩展 schema、UI 和审阅容量，不能只改配置。
- 优先使用现有 transcript/metadata；如果没有可靠的句级时间轴，先保留人工审阅，不把 LLM 时间戳直接当最终剪辑边界。
- 最终边界优先对齐完整句子、场景切换、音频连续性和有意的 cliffhanger。
- 支持轻度去除无效停顿；默认不删除有情绪作用的停顿、反应镜头或对白间隔。

### 4.2 Hook 内容评分

每个候选保存 0–100 的分项和总分。V1 的总分必须按以下公式计算并保存 `ranking_version`；若某项无证据，保存 `null`/缺失原因，不得默认为高分：

```text
Curiosity Gap          30%
Cliffhanger Strength   25%
Conflict               20%
Standalone Comprehension 15%
Emotional Intensity    10%
- Resolution Penalty    0–30
```

另外保存：

- `opening_strength_score`：前 1–3 秒是否立即有对白、冲突、表情或信息缺口。
- `platform_safety_score`：TikTok、Instagram、YouTube 分平台评分。
- `dedupe_status`：与其他候选的 transcript、时间范围和场景重叠情况。
- `review_status`：draft、approved、rejected、rendered、published。

应惩罚：片头 logo、空镜、走路、无关 setup、长转场、无声等待、过度暴露结局、相同片段重复产出。

### 4.3 文案与发布素材

每个 approved Hook 生成或提供可编辑的素材包：

- **Hook opening text**：前 1–3 秒的屏幕文字，短、直接、制造信息缺口。
- **字幕**：沿用现有字幕能力，保证时间准确、移动端可读、不遮挡脸和关键动作。
- **Cover text**：3–6 个词，突出冲突/秘密/反转，不复述完整结局。
- **Caption**：一条可发布 caption，明确冲突和继续观看动机，避免长篇剧情摘要。
- **Hashtags**：根据 drama/Hook 内容自动生成少量相关标签；避免重复堆砌、无关热门标签和承诺性夸张标签。不做 hashtag trend crawler 或 performance ranking。
- **CTA**：优先引导用户进入 DramaClips，再复制 code 到 ReelShort/RS 搜索；保持现有 affiliate 转化路径，不改成泛化的“下载 app”文案。
- **Cover image**：优先从 Hook 中选高冲突表情、对峙或 reveal 前一帧，不默认使用官方海报；V1 继续使用现有首帧/cover QA 能力，不新增独立图片生成服务。

文字内容必须保留生成依据和可编辑版本，不把 AI 输出直接写死到发布结果中。

## 5. 文案策略

### Opening text

优先以下方向：

- 直接点出秘密尚未揭晓。
- 点出角色关系冲突。
- 暗示即将发生的后果。
- 用问题制造继续观看动机。

避免：完整解释背景、重复对白、过长句子、只写“wait for it”之类无信息文案。

### Caption

结构建议：

```text
冲突一句话 + 未解决的问题一句话 + 简短 CTA
```

Caption 必须与实际片段一致，不得虚构片段中没有的情节；如使用剧名或角色名，优先从现有 drama metadata 获取。

### Hashtag

每个平台采用独立模板，至少支持：

- drama/series：剧名或剧集相关标签
- genre：romance、revenge、billionaire、family 等真实类型
- intent：shortdrama、dramaclips 等产品相关标签

初始版本只生成少量高相关标签，并允许人工删除/编辑；不承诺平台流量提升，也不把 hashtag 数量作为质量指标。Hashtag performance analysis 属于后续独立需求，当前不实现。

## 6. 页面与操作

沿用现有 `/admin`、Hook Studio、Publish Center 和现有 admin shell：

- Hook 候选列表：按总分、opening、safety、episode、状态筛选。
- 候选详情：预览、rough/final 时间、评分拆解、扣分原因、重复候选提示。
- Copy panel：opening text、cover text、caption、hashtags、CTA 分平台展示，可复制和编辑。
- Review flow：render 后先保持 draft/review-ready；只有现有 Hook Studio 的明确 approve/save 动作才写入 durable R2 `hook_clips`。Publish Center 只展示已保存的 R2 Hook；人工编辑发布 caption 仍可在 Publish Center 完成。

不新建第二套独立发布流程，不自动发布，不自动批量重试已成功的任务。

## 7. 数据与接口（概念）

优先复用现有 `hook_generation_jobs`、`hook_candidates`、`hook_clips`、`publish_packages` 和 analytics 数据。除非审计证明现有字段不足，不新建同名平行表。需要扩展时，建议字段或表包含：

- `hook_candidates`：沿用现有 `job_id`、`rank`、`source_ranges`、`rendered_ranges`、`score_components`、`risk_assessment`、`review_state`；新增字段必须说明 migration、读写方和回填策略。
- `hook_copy_variants`：不作为当前范围；沿用 publish package 中可编辑的 caption、CTA 和 hashtags。
- `hook_assets`：cover、rendered video、subtitle metadata、provider/job references。
- `hook_review_events`：approve/reject/edit/render/publish 及操作者和时间。

所有生成结果应可追溯到 candidate 和输入 metadata；不得在日志、fixture 或错误中暴露 provider secret 或真实 CPS URL。

## 8. 实施阶段

### Phase 1：现有链路审计与候选 metadata

确认当前 hook worker、评分、方向判断、render、cover、caption 和 publish package 的实际数据流；先输出字段映射和缺口清单，再新增 metadata。不得在未完成字段映射前新增 migration；不改变成功发布路径。

### Phase 2：Hook 评分、去重与边界

加入全局候选池、分项评分、resolution penalty、opening strength、平台安全和候选去重；使用现有能力完成可审阅的 rough/final boundary。

### Phase 3：文案与发布素材

加入 opening text、cover text、caption、hashtag、CTA 的生成、编辑、版本记录和平台模板；接入现有 cover/render/publish workflow。

验收重点：每个平台的文案字段可以独立编辑；生成内容仍能合成为最终 caption；没有真实数据时不声称某个 hashtag “最引流”。

### Phase 4：简单 Hashtag 生成

根据 drama title、drama tags、Hook type 和 Hook title 生成少量平台文案 tags；Publish Center 负责显示和编辑。没有外部数据依赖，不建立 crawler、performance snapshot 或 trend ranking。

### Phase 5：效果反馈（依赖明确，不属于首批交付）

将发布后的 views、watch-through、landing visits、outbound clicks、orders 和 revenue 与 hook/copy variant 关联，用于验证哪些剪辑和文案真正提高每千次曝光收入。V1 若没有可靠的平台 post ID、metric snapshot 和 provider conversion/revenue feed，只记录可获得的 DramaClips 内部事件，并标记 `not_attributable`；不得把 redirect 或 tracking event 当作订单/收入。

效果反馈应包含 hashtag set，而不是只记录整条 caption。至少支持比较：

- hashtag set → views / retention
- hashtag set → landing CTR
- hashtag set → outbound clicks
- hashtag set → orders / revenue per 1K views

有足够样本后，才用 DramaClips 自己的数据调整推荐权重；平台趋势数据只负责发现候选，不能替代转化验证。

## 9. 首批验收标准

- [ ] 不再强制每个 episode 产出一个 Hook。
- [ ] 候选按整部 drama 全局排序，支持同一 episode 多个不同候选。
- [ ] 每个候选有可解释的评分、resolution penalty、opening strength、safety 和 dedupe 状态。
- [ ] rough/final 时间边界可查看，最终结果不会只依赖未经校正的 LLM timestamp。
- [ ] Hook 详情可编辑 opening text、cover text、caption、hashtags 和 CTA。
- [ ] Hashtag 根据 drama/Hook 内容自动生成少量相关 tags。
- [ ] Hashtag 可人工删除和编辑，不依赖外部趋势 API。
- [ ] cover 优先从候选片段选择，字幕和文案遵守移动端安全区。
- [ ] 经明确 approve/save 的合格渲染结果保存到 R2，并可在 Publish Center 使用。
- [ ] 未经明确 approve/save 的 draft 不会出现在 Publish Center。
- [ ] 不改变已有 publish 成功路径，且不重复发布已确认成功的任务。
- [ ] 通过相关单元测试、typecheck、build 和 `git diff --check`。
- [ ] 明确区分 local 验证、migration、deployment 和真实平台效果验证。
