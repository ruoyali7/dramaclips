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

export function createR2Upload(input: { fileName: string; contentType: string; size: number; slug: string; kind?: "episode" | "cover" | "social" | "hook-draft" }) {
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
  const folder = kind === "social" ? "social/" : kind === "hook-draft" ? "social/drafts/" : "";
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

export async function promoteHookDraft(input:{sourceKey:string;slug:string;fileName:string;stableId?:string}){
  if(!input.sourceKey.startsWith(`dramas/${input.slug}/social/drafts/`))throw new Error("Draft object does not belong to this drama");
  const accountId=required("R2_ACCOUNT_ID"),accessKey=required("R2_ACCESS_KEY_ID"),secret=required("R2_SECRET_ACCESS_KEY"),bucket=required("R2_BUCKET_NAME");
  const publicBase=required("R2_PUBLIC_BASE_URL").replace(/\/$/,"");const host=`${accountId}.r2.cloudflarestorage.com`;
  const safe=cleanName(input.fileName);const stable=input.stableId?.replace(/[^a-zA-Z0-9-]/g,"")||`${Date.now()}-${crypto.randomUUID().slice(0,8)}`;const targetKey=`dramas/${input.slug}/social/hooks/${stable}-${safe}`;
  const targetUri=`/${encode(bucket)}/${targetKey.split("/").map(encode).join("/")}`;const copySource=`/${bucket}/${input.sourceKey}`;
  const now=new Date(),amzDate=now.toISOString().replace(/[:-]|\.\d{3}/g,""),date=amzDate.slice(0,8),scope=`${date}/auto/s3/aws4_request`;
  const payloadHash=crypto.createHash("sha256").update("").digest("hex");const canonicalHeaders=`host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-copy-source:${copySource}\nx-amz-date:${amzDate}\n`;
  const signedHeaders="host;x-amz-content-sha256;x-amz-copy-source;x-amz-date";const canonicalRequest=["PUT",targetUri,"",canonicalHeaders,signedHeaders,payloadHash].join("\n");
  const stringToSign=["AWS4-HMAC-SHA256",amzDate,scope,crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey=sign(sign(sign(sign(`AWS4${secret}`,date),"auto"),"s3"),"aws4_request");const signature=crypto.createHmac("sha256",signingKey).update(stringToSign).digest("hex");
  const response=await fetch(`https://${host}${targetUri}`,{method:"PUT",headers:{"x-amz-date":amzDate,"x-amz-content-sha256":payloadHash,"x-amz-copy-source":copySource,Authorization:`AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`}});
  if(!response.ok)throw new Error(`R2 copy returned ${response.status}`);return{objectKey:targetKey,publicUrl:`${publicBase}/${targetKey.split("/").map(encode).join("/")}`};
}

export async function uploadSocialVideo(input:{fileName:string;slug:string;bytes:Buffer}){
  const prepared=createR2Upload({fileName:input.fileName,contentType:"video/mp4",size:input.bytes.byteLength,slug:input.slug,kind:"social"});
  const response=await fetch(prepared.uploadUrl,{method:"PUT",headers:{"Content-Type":"video/mp4","Cache-Control":"public, max-age=31536000, immutable","Content-Length":String(input.bytes.byteLength)},body:new Uint8Array(input.bytes)});
  if(!response.ok)throw new Error(`R2 upload returned ${response.status}`);
  return prepared.publicUrl;
}

function xmlValue(block:string,name:string){const match=block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));return match?.[1]?.replaceAll("&amp;","&").replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&quot;",'"').replaceAll("&#39;","")||""}
async function signedR2Request(method:string,objectKey="",query:Record<string,string>={}){
  const accountId=required("R2_ACCOUNT_ID"),accessKey=required("R2_ACCESS_KEY_ID"),secret=required("R2_SECRET_ACCESS_KEY"),bucket=required("R2_BUCKET_NAME"),host=`${accountId}.r2.cloudflarestorage.com`;
  const uri=`/${encode(bucket)}${objectKey?`/${objectKey.split("/").map(encode).join("/")}`:""}`;const canonicalQuery=Object.entries(query).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${encode(key)}=${encode(value)}`).join("&");
  const now=new Date(),amzDate=now.toISOString().replace(/[:-]|\.\d{3}/g,""),date=amzDate.slice(0,8),scope=`${date}/auto/s3/aws4_request`,payloadHash=crypto.createHash("sha256").update("").digest("hex");
  const canonicalHeaders=`host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,signedHeaders="host;x-amz-content-sha256;x-amz-date",canonicalRequest=[method,uri,canonicalQuery,canonicalHeaders,signedHeaders,payloadHash].join("\n"),stringToSign=["AWS4-HMAC-SHA256",amzDate,scope,crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey=sign(sign(sign(sign(`AWS4${secret}`,date),"auto"),"s3"),"aws4_request"),signature=crypto.createHmac("sha256",signingKey).update(stringToSign).digest("hex");
  return fetch(`https://${host}${uri}${canonicalQuery?`?${canonicalQuery}`:""}`,{method,headers:{"x-amz-date":amzDate,"x-amz-content-sha256":payloadHash,Authorization:`AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`}});
}
export async function cleanupExpiredHookDrafts(before:Date){let token="",deleted=0,bytes=0;do{const query:Record<string,string>={"list-type":"2",prefix:"dramas/"};if(token)query["continuation-token"]=token;const response=await signedR2Request("GET","",query);if(!response.ok)throw new Error(`R2 list returned ${response.status}`);const xml=await response.text();for(const match of Array.from(xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g))){const block=match[1],key=xmlValue(block,"Key"),modified=new Date(xmlValue(block,"LastModified"));if(key.includes("/social/drafts/")&&modified<before){const removed=await signedR2Request("DELETE",key);if(!removed.ok)throw new Error(`R2 delete returned ${removed.status}`);deleted++;bytes+=Number(xmlValue(block,"Size")||0)}}token=xmlValue(xml,"NextContinuationToken")}while(token);return{deleted,bytes}}
export async function deleteR2Object(objectKey:string){if(!objectKey.startsWith("dramas/")||!objectKey.includes("/social/drafts/"))throw new Error("Only hook draft objects can be deleted");const response=await signedR2Request("DELETE",objectKey);if(!response.ok&&response.status!==404)throw new Error(`R2 delete returned ${response.status}`)}
export async function deleteSocialVideo(objectKey:string){if(!objectKey.startsWith("dramas/")||!objectKey.includes("/social/"))throw new Error("Only social video objects can be deleted");const response=await signedR2Request("DELETE",objectKey);if(!response.ok&&response.status!==404)throw new Error(`R2 delete returned ${response.status}`)}

const REMOTE_VIDEO_HOST="v-mps.crazymaplestudios.com";
export async function copyRemoteVideoToR2(input:{url:string;slug:string;episodeNumber:number}){
  const source=new URL(input.url);if(source.protocol!=="https:"||source.hostname!==REMOTE_VIDEO_HOST||!source.pathname.toLowerCase().endsWith(".mp4"))throw new Error("Remote video URL is not allowed");
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5*60*1000);
  try{
    const response=await fetch(source,{redirect:"manual",signal:controller.signal,headers:{Accept:"video/mp4,application/octet-stream"}});
    if(response.status>=300&&response.status<400)throw new Error("Remote video redirected to an unapproved host");
    if(!response.ok||!response.body)throw new Error(`Remote video returned ${response.status}`);
    const type=(response.headers.get("content-type")||"application/octet-stream").split(";")[0].trim();if(!["video/mp4","application/octet-stream","binary/octet-stream"].includes(type))throw new Error(`Unexpected remote content type: ${type}`);
    const size=Number(response.headers.get("content-length"));if(!Number.isFinite(size)||size<=0||size>MAX_FILE_BYTES)throw new Error("Remote video has an invalid or oversized Content-Length");
    const prepared=createR2Upload({fileName:`${String(input.episodeNumber).padStart(3,"0")}.mp4`,contentType:"video/mp4",size,slug:input.slug,kind:"episode"});
    const uploaded=await fetch(prepared.uploadUrl,{method:"PUT",headers:{"Content-Type":"video/mp4","Cache-Control":"public, max-age=31536000, immutable","Content-Length":String(size)},body:response.body,duplex:"half"} as RequestInit & {duplex:"half"});
    if(!uploaded.ok)throw new Error(`R2 upload returned ${uploaded.status}`);return{publicUrl:prepared.publicUrl,size};
  }finally{clearTimeout(timeout)}
}
