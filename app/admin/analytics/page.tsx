import { AdminShell } from "@/components/admin/admin-shell";
import { Stat } from "@/components/admin/stat";
import { getAnalyticsSummary } from "@/lib/admin/analytics-repository";

export const dynamic = "force-dynamic";

export default async function Page() {
  let summary;
  try { summary = await getAnalyticsSummary(); } catch { summary = null; }
  return <AdminShell active="Analytics">
    <div className="admin-title"><div><p>Last 30 days · 最近 30 天</p><h1>Analytics · 数据分析</h1></div></div>
    {summary ? <>
      <div className="stats">
        <Stat label="Tracked visits" value={summary.visits.toLocaleString()} delta="Page views + short links · 页面访问 + 短链点击" />
        <Stat label="Unique sessions" value={summary.sessions.toLocaleString()} delta="30-day cookie · 30 天 Cookie" />
        <Stat label="Continue watching clicks" value={summary.watchFullClicks.toLocaleString()} delta="Full-watch CTA clicks · 继续观看按钮点击" />
        <Stat label="Code copies" value={summary.promoCodeCopies.toLocaleString()} delta="Content Code copies · Content Code 复制" />
      </div>
      <section className="panel placeholder-panel"><span>Important · 重要说明</span><h2>Revenue is not live in this page</h2><p>This page tracks visits, playback, Content Code copies, and Continue watching clicks. RS orders and earnings must be imported separately. A CTA click is not an install or a paid conversion. · 本页统计访问、播放、Content Code 复制和继续观看点击；RS 订单与收入需要单独导入。按钮点击不等于安装或付费。</p></section>
      <div className="analytics-grids">
        <section className="panel analytics-table"><span>Preview funnel · 预告片漏斗</span><h2>From start to completion</h2><div><b>Preview starts · 预览开始</b><span>{summary.previewStarts.toLocaleString()}</span></div><div><b>Preview completions · 预览完成</b><span>{summary.previewCompletions.toLocaleString()}</span></div><div><b>All events · 全部事件</b><span>{summary.events.toLocaleString()}</span></div></section>
        <section className="panel analytics-table"><span>Traffic source · 流量来源</span><h2>Where visitors came from</h2>{summary.bySource.length ? summary.bySource.map(([name, count]) => <div key={name}><b>{name}</b><span>{count.toLocaleString()}</span></div>) : <p>No tracked visits yet. · 暂无跟踪访问。</p>}</section>
        <section className="panel analytics-table"><span>Drama · 剧集</span><h2>Most-clicked stories</h2>{summary.byDrama.length ? summary.byDrama.map(([name, count]) => <div key={name}><b>{name}</b><span>{count.toLocaleString()}</span></div>) : <p>No tracked visits yet. · 暂无跟踪访问。</p>}</section>
      </div>
    </> : <section className="panel placeholder-panel"><span>Setup required · 需要设置</span><h2>Run the Analytics migration</h2><p>Run the latest Supabase migration, then reload this page. · 执行最新 Supabase migration 后刷新本页。</p></section>}
  </AdminShell>;
}
