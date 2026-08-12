import "server-only";
import crypto from "node:crypto";

const MAX_FILE_BYTES = 10 * 1024 ** 3;
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-msvideo", "video/3gpp"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_COVER_BYTES = 20 * 1024 ** 2;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sign(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function cleanName(value: string) {
  const extension = value.includes(".") ? `.${value.split(".").pop()!.toLowerCase()}` : ".mp4";
  const stem = value.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "episode";
  return `${stem}${extension}`;
}

export function createR2Upload(input: { fileName: string; contentType: string; size: number; slug: string; kind?: "episode" | "cover" }) {
  const kind = input.kind || "episode";
  if (kind === "cover") {
    if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_COVER_BYTES) throw new Error("Cover must be between 1 byte and 20 MB");
    if (!IMAGE_TYPES.has(input.contentType)) throw new Error("Use a JPG, PNG, or WebP cover image");
  } else {
    if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_FILE_BYTES) throw new Error("Video must be between 1 byte and 10 GB");
    if (!VIDEO_TYPES.has(input.contentType)) throw new Error("Use MP4, MOV, AVI, or 3GP video files");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new Error("Add a valid drama slug before uploading");

  const accountId = required("R2_ACCOUNT_ID");
  const accessKey = required("R2_ACCESS_KEY_ID");
  const secret = required("R2_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET_NAME");
  const publicBase = required("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const objectKey = `dramas/${input.slug}/${kind === "cover" ? "cover-" : ""}${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${cleanName(input.fileName)}`;
  const canonicalUri = `/${encode(bucket)}/${objectKey.split("/").map(encode).join("/")}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const parameters: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "900",
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&");
  const canonicalRequest = ["PUT", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const dateKey = sign(`AWS4${secret}`, date);
  const regionKey = sign(dateKey, "auto");
  const serviceKey = sign(regionKey, "s3");
  const signingKey = sign(serviceKey, "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    uploadUrl: `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    publicUrl: `${publicBase}/${objectKey.split("/").map(encode).join("/")}`,
    objectKey,
    expiresIn: 900,
  };
}
