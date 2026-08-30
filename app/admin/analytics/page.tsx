import { AdminShell } from "@/components/admin/admin-shell";
import { Stat } from "@/components/admin/stat";
import { getAnalyticsSummary, type AnalyticsSummary } from "@/lib/admin/analytics-repository";

export const dynamic = "force-dynamic";

const timeZone = process.env.ANALYTICS_TIME_ZONE || "America/Los_Angeles";
const metrics = [
  ["Visits · 访问", "visits"],
  ["Bio visits · Bio 访问", "bioVisits"],
  ["Preview starts · 预览开始", "previewStarts"],
  ["Continue clicks · 继续观看", "watchFullClicks"],
  ["Code copies · 代码复制", "promoCodeCopies"],
  ["RS redirects · 跳转 RS", "rsRedirects"],
] as const;

function zonedDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function zonedMidnight(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(candidate));
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const represented = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute), Number(value.second));
    candidate += target - represented;
  }
  return new Date(candidate);
}

function startOfDay(daysAgo: number) {
  const [year, month, day] = zonedDateKey(new Date()).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day - daysAgo));
  return zonedMidnight(shifted.toISOString().slice(0, 10));
}

function subtract(total: AnalyticsSummary, recent: AnalyticsSummary, key: typeof metrics[number][1]) {
  return Math.max(0, total[key] - recent[key]);
}

function change(current: number, previous: number) {
  if (!previous) return current ? "New activity · 新增" : "No change · 无变化";
  const percent = Math.round(((current - previous) / previous) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

function GrowthPanel({ title, subtitle, current, previous }: { title: string; subtitle: string; current: AnalyticsSummary; previous: AnalyticsSummary | null }) {
  return <section className="panel analytics-table growth-panel"><span>{subtitle}</span><h2>{title}</h2>{metrics.map(([label,key]) => {
    const value = current[key];
    const prior = previous ? previous[key] : 0;
    return <div key={key}><b>{label}</b><span><strong>{value.toLocaleString()}</strong><small>{change(value, prior)}</small></span></div>;
  })}</section>;
}

export default async function Page() {
  let summary, today, yesterday, last7, previous7;
  try {
    const [month, todayTotal, sinceYesterday, weekTotal, sincePreviousWeek] = await Promise.all([
      getAnalyticsSummary(), getAnalyticsSummary(startOfDay(0)), getAnalyticsSummary(startOfDay(1)), getAnalyticsSummary(startOfDay(7)), getAnalyticsSummary(startOfDay(14)),
    ]);
    summary = month;
    today = todayTotal;
    yesterday = { ...sinceYesterday };
    last7 = weekTotal;
    previous7 = { ...sincePreviousWeek };
    for (const [,key] of metrics) {
      yesterday[key] = subtract(sinceYesterday, todayTotal, key);
      previous7[key] = subtract(sincePreviousWeek, weekTotal, key);
    }
  } catch { summary = null; }
  return <AdminShell active="Analytics">
    <div className="admin-title"><div><p>Last 30 days · 最近 30 天</p><h1>Analytics · 数据分析</h1></div></div>
    {summary ? <>
      <div className="stats">
        <Stat label="Tracked visits" value={summary.visits.toLocaleString()} delta={`Bio ${summary.bioVisits.toLocaleString()} · Clip ${summary.clipVisits.toLocaleString()}`} />
        <Stat label="Unique sessions" value={summary.sessions.toLocaleString()} delta="30-day cookie · 30 天 Cookie" />
        <Stat label="Continue watching clicks" value={summary.watchFullClicks.toLocaleString()} delta={`今日新增 ${today?.watchFullClicks ?? 0} · Full-watch CTA`} />
        <Stat label="Code copies" value={summary.promoCodeCopies.toLocaleString()} delta={`今日新增 ${today?.promoCodeCopies ?? 0} · Content Code`} />
        <Stat label="RS redirects" value={summary.rsRedirects.toLocaleString()} delta={`今日新增 ${today?.rsRedirects ?? 0} · Jump initiated`} />
      </div>
      {today && yesterday && last7 && previous7 && <div className="analytics-growth">
        <GrowthPanel title="Today · 今天" subtitle={`Today vs yesterday · ${timeZone}`} current={today} previous={yesterday} />
        <GrowthPanel title="Last 7 days · 最近 7 天" subtitle="Compared with previous 7 days · 对比前 7 天" current={last7} previous={previous7} />
      </div>}
      <section className="panel placeholder-panel"><span>Important · 重要说明</span><h2>Revenue is not live in this page</h2><p>This page tracks visits, playback, Content Code copies, and Continue watching clicks. RS orders and earnings must be imported separately. A CTA click is not an install or a paid conversion. · 本页统计访问、播放、Content Code 复制和继续观看点击；RS 订单与收入需要单独导入。按钮点击不等于安装或付费。</p></section>
      <div className="analytics-grids">
        <section className="panel analytics-table"><span>Preview funnel · 预告片漏斗</span><h2>From start to completion</h2><div><b>Preview starts · 预览开始</b><span>{summary.previewStarts.toLocaleString()}</span></div><div><b>Preview completions · 预览完成</b><span>{summary.previewCompletions.toLocaleString()}</span></div><div><b>All events · 全部事件</b><span>{summary.events.toLocaleString()}</span></div></section>
        <section className="panel analytics-table"><span>Traffic source · 流量来源</span><h2>Where visitors came from</h2>{summary.bySource.length ? summary.bySource.map(([name, count]) => <div key={name}><b>{name}</b><span>{count.toLocaleString()}</span></div>) : <p>No tracked visits yet. · 暂无跟踪访问。</p>}</section>
        <section className="panel analytics-table"><span>Drama · 剧集</span><h2>Most-clicked stories</h2>{summary.byDrama.length ? summary.byDrama.map(([name, count]) => <div key={name}><b>{name}</b><span>{count.toLocaleString()}</span></div>) : <p>No tracked visits yet. · 暂无跟踪访问。</p>}</section>
      </div>
    </> : <section className="panel placeholder-panel"><span>Setup required · 需要设置</span><h2>Run the Analytics migration</h2><p>Run the latest Supabase migration, then reload this page. · 执行最新 Supabase migration 后刷新本页。</p></section>}
  </AdminShell>;
}
