type Range = { start: number; end: number };

export function renderedHookCoverTimestamp(input: {
  sourceRanges?: Range[];
  renderedRanges?: Range[];
  coverSourceTimestamp?: number;
  durationSeconds?: number;
}) {
  const sourceTimestamp = Number(input.coverSourceTimestamp);
  if (!Number.isFinite(sourceTimestamp)) return 0;
  const sourceRanges = input.sourceRanges || [];
  const renderedRanges = input.renderedRanges || [];
  const index = sourceRanges.findIndex(
    (range) => sourceTimestamp >= range.start && sourceTimestamp <= range.end,
  );
  const source = sourceRanges[index];
  const rendered = renderedRanges[index];
  const timestamp = source && rendered
    ? rendered.start + sourceTimestamp - source.start
    : 0;
  const max = Math.max(0, Number(input.durationSeconds || 0) - 0.1);
  return Math.max(0, Math.min(timestamp, max));
}
