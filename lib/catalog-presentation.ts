export function summarizeDescription(description: string, maxLength = 150) {
  const clean = description.trim().replace(/\s+/g, " ");
  if (clean.length <= maxLength) return clean;
  const candidate = clean.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(candidate.lastIndexOf("."), candidate.lastIndexOf("!"), candidate.lastIndexOf("?"));
  if (sentenceEnd >= Math.min(80, maxLength / 2)) return candidate.slice(0, sentenceEnd + 1);
  const wordEnd = candidate.lastIndexOf(" ", maxLength);
  return `${candidate.slice(0, wordEnd > 0 ? wordEnd : maxLength).trimEnd()}…`;
}

export function uniqueTags(tags: string[]) {
  const seen = new Set<string>();
  return tags.filter(tag => {
    const key = tag.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
