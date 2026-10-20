export type PublicFunnelCounts = {
  landingVisitors: number;
  watchVisitors: number;
  previewStartVisitors: number;
  previewCompleteVisitors: number;
  outboundVisitors: number;
  confirmedRedirectVisitors: number;
};

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round(numerator / denominator * 1000) / 10 : 0;
}

export function publicFunnelRates(counts: PublicFunnelCounts) {
  return {
    landingToWatch: percent(counts.watchVisitors, counts.landingVisitors),
    watchStart: percent(counts.previewStartVisitors, counts.watchVisitors),
    previewCompletion: percent(counts.previewCompleteVisitors, counts.previewStartVisitors),
    outboundCtr: percent(counts.outboundVisitors, counts.watchVisitors),
    confirmedRedirectRate: percent(counts.confirmedRedirectVisitors, counts.outboundVisitors)
  };
}
