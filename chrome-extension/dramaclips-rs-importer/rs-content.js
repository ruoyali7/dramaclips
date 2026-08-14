const MAX_CAPTURE_LENGTH = 100000;

function captureVisiblePage() {
  const values = [...document.querySelectorAll("input, textarea")].map((element) => element.value).filter(Boolean);
  const links = [...document.querySelectorAll("a[href]")].map((element) => element.href).filter(Boolean);
  const images = [...document.images].map((image) => `DRAMACLIPS_IMAGE|${image.alt || ""}|${image.currentSrc || image.src}|${image.naturalWidth}|${image.naturalHeight}`);
  const metadata = ["DRAMACLIPS_CAPTURED_VALUES", ...values, ...links, ...images].join("\n");
  const bodyLimit = Math.max(0, MAX_CAPTURE_LENGTH - metadata.length - 1);
  return [(document.body?.innerText || "").slice(0, bodyLimit), metadata].join("\n");
}

function pageLooksReady() {
  const text = document.body?.innerText || "";
  const values = [...document.querySelectorAll("input, textarea")].map((element) => element.value).filter(Boolean);
  const promotionLinks = values.filter((value) => /^https:\/\/reelslink\.com\/cps\//i.test(value));
  const referralCode = values.find((value) => /^\d{4,8}$/.test(value));
  const cover = [...document.images].find((image) => /cover/i.test(image.alt || "") && image.naturalWidth >= 160 && image.naturalHeight > image.naturalWidth);
  return /Content Promotion Link|资源推广链接/i.test(text) && /Release Date|上线时间/i.test(text) && /\d+\s*(?:Episodes?|Chapters?)|共\s*\d+\s*章/i.test(text) && promotionLinks.length >= 2 && Boolean(referralCode) && Boolean(cover);
}

async function waitForPage() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (pageLooksReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CAPTURE_RS_PAGE") return;
  void waitForPage().then((ready) => sendResponse(ready ? { ok: true, text: captureVisiblePage(), url: window.location.href } : { ok: false, message: "RS Boost did not finish loading. Confirm that Chrome is signed in and the drama page is available." }));
  return true;
});

chrome.runtime.sendMessage({ type: "RS_PAGE_READY", url: window.location.href });
