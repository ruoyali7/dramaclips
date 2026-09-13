// Matches the three production publishing cron schedules (UTC).
// Keep this list in sync when changing Railway publishing schedules.
const utcMinutes=[60,70,270,280,290,840,850,1140,1150,1160];
export function nextPublishWorkerWindow(scheduledAt:string){
  const requested=new Date(scheduledAt);
  if(!Number.isFinite(requested.getTime()))return null;
  const midnight=Date.UTC(requested.getUTCFullYear(),requested.getUTCMonth(),requested.getUTCDate());
  for(const day of [0,1])for(const minute of utcMinutes){const timestamp=midnight+day*86400000+minute*60000;if(timestamp>=requested.getTime())return new Date(timestamp).toISOString();}
  return null;
}
