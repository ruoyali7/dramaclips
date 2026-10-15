const PENDING_KEY = "pendingRsImport";
const INSTAGRAM_LOGIN_URL = "https://www.instagram.com/accounts/login/";

function trustedAdminPage(value) {
  try {
    const url = new URL(value);
    const local = (url.hostname === "localhost" || url.hostname === "127.0.0.1") && (url.port === "3000" || url.port === "3001");
    return (url.protocol === "https:" && url.hostname === "dramaclips.vercel.app" || url.protocol === "http:" && local) && url.pathname === "/admin/posters";
  } catch { return false; }
}

function validRsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cps.reelshort.com" && /^\/resource-square\/detail\/[a-f0-9]+$/i.test(url.pathname) ? url.toString() : null;
  } catch { return null; }
}

async function fail(sourceTabId, message, rsTabId) {
  if (sourceTabId) await chrome.tabs.sendMessage(sourceTabId, { type: "RS_IMPORT_ERROR", message }).catch(() => {});
  if (rsTabId) await chrome.tabs.remove(rsTabId).catch(() => {});
  await chrome.storage.session.remove(PENDING_KEY);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_INSTAGRAM_LOGIN") {
    if (!trustedAdminPage(sender.url)) { sendResponse({ ok: false, message: "Open this from the DramaClips Poster page." }); return; }
    void chrome.tabs.create({ url: INSTAGRAM_LOGIN_URL, active: true })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false, message: "Could not open Instagram login." }));
    return true;
  }

  if (message?.type === "READ_INSTAGRAM_SESSION") {
    if (!trustedAdminPage(sender.url)) { sendResponse({ ok: false, message: "Open this from the DramaClips Poster page." }); return; }
    void chrome.cookies.get({ url: "https://www.instagram.com/", name: "sessionid" })
      .then((cookie) => sendResponse(cookie?.value ? { ok: true, sessionId: cookie.value } : { ok: false, message: "No signed-in Instagram session was found. Log in to Instagram first." }))
      .catch(() => sendResponse({ ok: false, message: "Could not read the Instagram session." }));
    return true;
  }

  if (message?.type === "START_RS_IMPORT") {
    void (async () => {
      const url = validRsUrl(message.url);
      if (!url || !sender.tab?.id) { sendResponse({ ok: false, message: "Use a valid RS Boost drama detail link." }); return; }
      const rsTab = await chrome.tabs.create({ url: "about:blank", active: false });
      await chrome.storage.session.set({ [PENDING_KEY]: { sourceTabId: sender.tab.id, rsTabId: rsTab.id, url, startedAt: Date.now() } });
      await chrome.tabs.update(rsTab.id, { url, active: true });
      sendResponse({ ok: true });
    })().catch((error) => sendResponse({ ok: false, message: error.message || "Could not open RS Boost." }));
    return true;
  }

  if (message?.type === "RS_PAGE_READY") {
    void (async () => {
      const stored = await chrome.storage.session.get(PENDING_KEY);
      const pending = stored[PENDING_KEY];
      if (!pending || sender.tab?.id !== pending.rsTabId || validRsUrl(message.url) !== pending.url) return;
      chrome.tabs.sendMessage(pending.rsTabId, { type: "CAPTURE_RS_PAGE" }, async (result) => {
        if (chrome.runtime.lastError || !result?.ok) { await fail(pending.sourceTabId, result?.message || "Could not read the signed-in RS Boost page.", pending.rsTabId); return; }
        await chrome.tabs.sendMessage(pending.sourceTabId, { type: "RS_IMPORT_RESULT", url: result.url, text: result.text, videos: result.videos }).catch(() => {});
        await chrome.tabs.update(pending.sourceTabId, { active: true }).catch(() => {});
        await chrome.tabs.remove(pending.rsTabId).catch(() => {});
        await chrome.storage.session.remove(PENDING_KEY);
      });
    })();
  }
});
