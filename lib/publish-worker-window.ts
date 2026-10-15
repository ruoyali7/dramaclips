export function nextPublishWorkerWindow(scheduledAt:string){
  const requested=new Date(scheduledAt);
  if(!Number.isFinite(requested.getTime()))return null;
  return requested.toISOString();
}
