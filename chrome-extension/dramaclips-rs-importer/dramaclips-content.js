const SITE_SOURCE = "dramaclips";
const EXTENSION_SOURCE = "dramaclips-rs-extension";

function announce() {
  window.postMessage({ source: EXTENSION_SOURCE, type: "RS_EXTENSION_READY" }, window.location.origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== SITE_SOURCE) return;
  if (event.data.type === "RS_EXTENSION_PING") { announce(); return; }
  if (event.data.type === "INSTAGRAM_LOGIN_OPEN_REQUEST") {
    chrome.runtime.sendMessage({ type: "OPEN_INSTAGRAM_LOGIN" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) window.postMessage({ source: EXTENSION_SOURCE, type: "INSTAGRAM_LOGIN_OPEN_RESULT", ok: false, message: response?.message || "Could not open Instagram login." }, window.location.origin);
      else window.postMessage({ source: EXTENSION_SOURCE, type: "INSTAGRAM_LOGIN_OPEN_RESULT", ok: true }, window.location.origin);
    });
    return;
  }
  if (event.data.type === "INSTAGRAM_SESSION_CONNECT_REQUEST") {
    chrome.runtime.sendMessage({ type: "READ_INSTAGRAM_SESSION" }, async (response) => {
      if (chrome.runtime.lastError || !response?.ok || typeof response.sessionId !== "string") {
        window.postMessage({ source: EXTENSION_SOURCE, type: "INSTAGRAM_SESSION_CONNECT_RESULT", ok: false, message: response?.message || "Could not read the Instagram session." }, window.location.origin);
        return;
      }
      try {
        const save = await fetch("/api/admin/instagram-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: response.sessionId }) });
        const result = await save.json().catch(() => ({}));
        window.postMessage({ source: EXTENSION_SOURCE, type: "INSTAGRAM_SESSION_CONNECT_RESULT", ok: save.ok, message: save.ok ? undefined : result.message || "Could not save the Instagram session." }, window.location.origin);
      } catch {
        window.postMessage({ source: EXTENSION_SOURCE, type: "INSTAGRAM_SESSION_CONNECT_RESULT", ok: false, message: "Could not reach DramaClips." }, window.location.origin);
      }
    });
    return;
  }
  if (event.data.type !== "RS_IMPORT_REQUEST" || typeof event.data.url !== "string") return;
  chrome.runtime.sendMessage({ type: "START_RS_IMPORT", url: event.data.url }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) window.postMessage({ source: EXTENSION_SOURCE, type: "RS_IMPORT_ERROR", message: response?.message || "Could not start the RS Boost import." }, window.location.origin);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "RS_IMPORT_RESULT") window.postMessage({ source: EXTENSION_SOURCE, type: "RS_IMPORT_RESULT", url: message.url, text: message.text, videos: message.videos }, window.location.origin);
  if (message?.type === "RS_IMPORT_ERROR") window.postMessage({ source: EXTENSION_SOURCE, type: "RS_IMPORT_ERROR", message: message.message }, window.location.origin);
});

announce();
