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

export function createR2Upload(input: { fileName: string; contentType: string; size: number; slug: string; kind?: "episode" | "cover" | "social" }) {
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
  const folder = kind === "social" ? "social/" : "";
  const objectKey = `dramas/${input.slug}/${folder}${kind === "cover" ? "cover-" : ""}${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${cleanName(input.fileName)}`;
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

const RS_VIDEO_HOST=/^[a-z0-9.-]+\.oss-accelerate\.aliyuncs\.com$/i;
export async function copyRsVideoToR2(input:{url:string;slug:string;episodeNumber:number}){
  const source=new URL(input.url);if(source.protocol!=="https:"||!RS_VIDEO_HOST.test(source.hostname))throw new Error("RS video host is not allowed");
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5*60*1000);
  try{
    const response=await fetch(source,{redirect:"manual",signal:controller.signal,headers:{Accept:"video/mp4,application/octet-stream"}});
    if(response.status>=300&&response.status<400)throw new Error("RS video redirected to an unapproved host");
    if(!response.ok||!response.body)throw new Error(`RS video returned ${response.status}`);
    const type=(response.headers.get("content-type")||"application/octet-stream").split(";")[0].trim();if(!["video/mp4","application/octet-stream","binary/octet-stream"].includes(type))throw new Error(`Unexpected RS content type: ${type}`);
    const size=Number(response.headers.get("content-length"));if(!Number.isFinite(size)||size<=0||size>MAX_FILE_BYTES)throw new Error("RS video has an invalid or oversized Content-Length");
    const prepared=createR2Upload({fileName:`${String(input.episodeNumber).padStart(3,"0")}.mp4`,contentType:"video/mp4",size,slug:input.slug,kind:"episode"});
    const uploaded=await fetch(prepared.uploadUrl,{method:"PUT",headers:{"Content-Type":"video/mp4","Content-Length":String(size)},body:response.body,duplex:"half"} as RequestInit & {duplex:"half"});
    if(!uploaded.ok)throw new Error(`R2 upload returned ${uploaded.status}`);return{publicUrl:prepared.publicUrl,size};
  }finally{clearTimeout(timeout)}
}
