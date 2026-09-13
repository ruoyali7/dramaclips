type Task={status:string;yixiaoerResults?:Record<string,unknown>;yixiaoerError?:string;platforms:{source:string}[]};
export function hasUncertainOutcome(task:Task){return Object.values(task.yixiaoerResults||{}).some(result=>result&&typeof result==="object"&&(result as Record<string,unknown>).state==="outcome_unknown");}
export function publishedPlatformCount(task:Task){return task.platforms.filter(platform=>{const result=task.yixiaoerResults?.[platform.source];return result&&typeof result==="object"&&(result as Record<string,unknown>).state==="published";}).length;}
export function recoveryGuidance(task:Task){
  if(hasUncertainOutcome(task))return "The provider may have published this post. Check the result before retrying.";
  const operation=task.yixiaoerResults?._operation as Record<string,unknown>|undefined;
  const error=task.yixiaoerError||"";
  if(/401|expired|unauthori|credential/i.test(error))return "Check the publishing credentials, then retry the affected platform.";
  if(/upload|download/.test(String(operation?.stage)))return "The media transfer failed. Check the source and retry the upload.";
  if(/504|timeout/i.test(error))return "A service timed out. Review platform results before deciding whether to retry.";
  return "Review the affected platform’s error. Correct the cause before retrying; successful platforms are kept.";
}
export function platformError(result:unknown){
  if(!result||typeof result!=="object")return "";
  const detail=result as {error?:string;reconciliation?:{tasks?:{errorMessage?:string}[]}};
  return detail.reconciliation?.tasks?.map(task=>task.errorMessage).filter(Boolean).join(" · ")||detail.error||"";
}
export function platformPostUrl(result:unknown){
  if(!result||typeof result!=="object")return undefined;
  const detail=result as {platformPostUrl?:string;reconciliation?:{tasks?:{openUrl?:string}[]}};
  const url=detail.platformPostUrl||detail.reconciliation?.tasks?.find(task=>task.openUrl)?.openUrl;
  return url&&/^https?:\/\//i.test(url)?url:undefined;
}
