const SITE_SOURCE = "dramaclips";
const EXTENSION_SOURCE = "dramaclips-rs-extension";

function announce() {
  window.postMessage({ source: EXTENSION_SOURCE, type: "RS_EXTENSION_READY" }, window.location.origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== SITE_SOURCE) return;
  if (event.data.type === "RS_EXTENSION_PING") { announce(); return; }
  if (event.data.type !== "RS_IMPORT_REQUEST" || typeof event.data.url !== "string") return;
  chrome.runtime.sendMessage({ type: "START_RS_IMPORT", url: event.data.url }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) window.postMessage({ source: EXTENSION_SOURCE, type: "RS_IMPORT_ERROR", message: response?.message || "Could not start the RS Boost import." }, window.location.origin);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "RS_IMPORT_RESULT") window.postMessage({ source: EXTENSION_SOURCE, type: "RS_IMPORT_RESULT", url: message.url, text: message.text }, window.location.origin);
  if (message?.type === "RS_IMPORT_ERROR") window.postMessage({ source: EXTENSION_SOURCE, type: "RS_IMPORT_ERROR", message: message.message }, window.location.origin);
});

announce();
