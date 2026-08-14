const PENDING_KEY = "pendingRsImport";

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
        await chrome.tabs.sendMessage(pending.sourceTabId, { type: "RS_IMPORT_RESULT", url: result.url, text: result.text }).catch(() => {});
        await chrome.tabs.update(pending.sourceTabId, { active: true }).catch(() => {});
        await chrome.tabs.remove(pending.rsTabId).catch(() => {});
        await chrome.storage.session.remove(PENDING_KEY);
      });
    })();
  }
});
