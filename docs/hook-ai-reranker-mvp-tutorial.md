# Built-in Hook AI Reranker MVP 教程

## 目标

这次 MVP 不重写剪辑器，也不让模型直接编辑视频。现有程序先用 Faster-Whisper、PySceneDetect、OpenCV 和规则评分生成候选；LLM 只负责重新判断候选的剧情清晰度、冲突、情绪升级和结尾悬念。

## 代码入口

`worker/hook_worker/main.py` 的 `run()` 是任务编排器。它依次下载、转写、检测场景、生成候选并渲染。

`worker/hook_worker/scoring.py` 是旧的规则排序器。

`worker/hook_worker/ai_reranker.py` 是新的可选 AI 层。它调用 Responses API，接收候选对白和时间范围，并通过严格 JSON Schema 返回排序结果。

## 为什么单独做模块

`main.py` 负责流程，`ai_reranker.py` 负责模型调用。这样可以单独测试、替换模型、关闭 AI，并保留规则系统作为降级路径。第一版没有新增 API route，因为任务本身已经由 Railway worker 异步执行；浏览器不应该接触 `OPENAI_API_KEY`。

## 当前流程

```text
规则候选生成
  → AI reranker（可选）
  → 重新编号
  → 原有 FFmpeg render
  → 原有 QA / R2 上传
```

模型只能影响候选顺序和解释，不能直接改变时间点、删除候选、修改 FFmpeg 参数或控制发布行为。模型判断为 `keep=false` 的候选仍会保留，只会排到后面。

## 开关与配置

Railway worker 设置：

```text
OPENAI_API_KEY=server-side-secret
HOOK_AI_RERANKER_ENABLED=true
HOOK_AI_MODEL=gpt-5-mini
HOOK_AI_TIMEOUT_SECONDS=45
```

不设置 `HOOK_AI_RERANKER_ENABLED=true` 时，行为与旧版相同。API 失败、JSON 无效或响应超时，也会回退到规则排序。

## 模型实际看到的数据

每个候选只发送以下内容，不上传整部视频：

```json
{
  "id": "2-1",
  "episode": 2,
  "start": 124.5,
  "end": 158.2,
  "transcript": "you lied to me ...",
  "ruleScore": 61.4
}
```

`transcript` 来自现有 Faster-Whisper 结果。API 返回结果必须完整覆盖每个候选 ID；缺少候选、出现重复 ID、分数越界或类型错误时，整次 AI 排序作废并回退到规则排序。

## 阅读顺序

1. 先看 `run()`，理解任务阶段。
2. 再看 `candidates()`，理解候选如何产生。
3. 再看 `ai_reranker.py`，理解模型输入、输出和降级。
4. 最后看 `render()`，确认 AI 没有接管媒体渲染。

## 验收标准

第一版只验证：AI 排序是否比规则排序更常选出完整、有冲突、有悬念的片段。不要先追求全自动 Agent。后续如果人工反馈证明排序有效，再增加关键帧、视觉模型、时间点调整和自动重试。

建议使用同一批已人工判断的视频做 A/B 验收：关闭开关记录规则排序，再开启开关记录 AI 排序，比较前两名中真正可用 hook 的比例。只有排序改进得到真实样本支持后，再进入下一阶段。
