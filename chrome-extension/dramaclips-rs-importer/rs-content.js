const MAX_CAPTURE_LENGTH = 100000;

function pageRequest() {
  const match = window.location.pathname.match(/^\/resource-square\/detail\/([a-f0-9]+)$/i);
  if (!match) throw new Error("This is not an RS Boost drama detail page.");
  const params = new URLSearchParams(window.location.search);
  return { app: params.get("app") || "reelshort", book_id: match[1], book_type: Number(params.get("book_type") || 0) };
}

async function captureFreeVideos() {
  const token = window.localStorage.getItem("token");
  if (!token) throw new Error("RS Boost is not signed in. Sign in and try again.");
  const response = await fetch("https://cps.reelshort.com/api/v1/book/book-detail", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Accept-Language": "en" },
    body: JSON.stringify(pageRequest()),
  });
  if (response.status === 401) throw new Error("RS Boost login expired. Sign in and try again.");
  if (!response.ok) throw new Error(`RS Boost returned ${response.status} while reading free videos.`);
  const payload = await response.json();
  if (payload?.code !== 0) throw new Error(payload?.msg || "RS Boost did not return the free videos.");
  const chapters = Array.isArray(payload?.data?.chapters) ? payload.data.chapters : [];
  return chapters.map((chapter, index) => ({
    episodeNumber: Number(chapter?.t_chapter_id) || index + 1,
    url: typeof chapter?.play_url === "string" ? chapter.play_url : "",
  })).filter((chapter) => chapter.url).slice(0, 100);
}

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
  void waitForPage().then(async (ready) => {
    if (!ready) return sendResponse({ ok: false, message: "RS Boost did not finish loading. Confirm that Chrome is signed in and the drama page is available." });
    try {
      sendResponse({ ok: true, text: captureVisiblePage(), videos: await captureFreeVideos(), url: window.location.href });
    } catch (error) {
      sendResponse({ ok: false, message: error instanceof Error ? error.message : "Could not read the free RS videos." });
    }
  });
  return true;
});

chrome.runtime.sendMessage({ type: "RS_PAGE_READY", url: window.location.href });
