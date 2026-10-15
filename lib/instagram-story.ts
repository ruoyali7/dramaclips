export function reelShortUrl(value:string){
 const matches=value.match(/https?:\/\/[^\s<>]+/gi)||[];
 for(const match of matches){
  const candidate=match.replace(/[),.!?]+$/,"");
  try{const url=new URL(candidate);if(url.protocol==="https:"&&(url.hostname==="reelslink.com"||url.hostname.endsWith(".reelslink.com")))return url.toString()}catch{}
 }
}
