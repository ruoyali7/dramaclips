export function getSupabaseConfig(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");const key=process.env.SUPABASE_SERVICE_ROLE_KEY;const configured=!!url&&!!key&&!url.includes("placeholder")&&!key.includes("placeholder");return{configured,url:url||"",key:key||""}}
export function repositoryMode(){return getSupabaseConfig().configured?"supabase" as const:"local" as const}

function isLocalUrl(value:string){try{return ["localhost","127.0.0.1","::1"].includes(new URL(value).hostname)}catch{return false}}
export function assertSafeDevelopmentPublishingDatabase(environment:NodeJS.ProcessEnv=process.env){
  if(environment.NODE_ENV!=="development")return;
  const url=(environment.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/$/,"");
  if(!url||isLocalUrl(url))return;
  const projectRef=(environment.DEV_SUPABASE_PROJECT_REF||"").trim().toLowerCase();
  let hostname="";try{hostname=new URL(url).hostname.toLowerCase()}catch{}
  if(environment.ALLOW_REMOTE_DEVELOPMENT_DB==="true"&&projectRef&&hostname===`${projectRef}.supabase.co`)return;
  throw new Error("Publishing mutations are blocked: local development must use local Supabase or an explicitly allowlisted development project");
}
