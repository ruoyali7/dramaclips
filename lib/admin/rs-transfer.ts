export const RS_TRANSFER_PREFIX = "__DRAMACLIPS_RS_IMPORT__";

export type RsTransfer = { version: 1; source: string; text: string };

export function readRsTransfer(value: string): RsTransfer | null {
  if (!value.startsWith(RS_TRANSFER_PREFIX)) return null;
  try {
    const payload = JSON.parse(value.slice(RS_TRANSFER_PREFIX.length)) as Partial<RsTransfer>;
    const source = new URL(payload.source || "");
    if (payload.version !== 1 || source.hostname !== "cps.reelshort.com" || typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 100000) return null;
    return { version: 1, source: source.toString(), text: payload.text };
  } catch {
    return null;
  }
}

export function rsBookmarklet(destination: string) {
  const target = JSON.stringify(destination);
  const prefix = JSON.stringify(RS_TRANSFER_PREFIX);
  return `javascript:(()=>{try{window.name=${prefix}+JSON.stringify({version:1,source:location.href,text:document.body.innerText});location.href=${target}}catch(error){alert('DramaClips import failed: '+error.message)}})()`;
}
