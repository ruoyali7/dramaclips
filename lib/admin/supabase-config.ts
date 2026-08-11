export function getSupabaseConfig(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");const key=process.env.SUPABASE_SERVICE_ROLE_KEY;const configured=!!url&&!!key&&!url.includes("placeholder")&&!key.includes("placeholder");return{configured,url:url||"",key:key||""}}
export function repositoryMode(){return getSupabaseConfig().configured?"supabase" as const:"local" as const}
