export const ANALYTICS_TIME_ZONE = "America/Los_Angeles";

export function zonedDateKey(date:Date,timeZone=ANALYTICS_TIME_ZONE){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export function zonedMidnight(dateKey:string,timeZone=ANALYTICS_TIME_ZONE){
  const [year,month,day]=dateKey.split("-").map(Number);const target=Date.UTC(year,month-1,day);let candidate=target;
  for(let attempt=0;attempt<3;attempt++){
    const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(candidate));
    const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    candidate+=target-Date.UTC(Number(value.year),Number(value.month)-1,Number(value.day),Number(value.hour),Number(value.minute),Number(value.second));
  }
  return new Date(candidate);
}
export function analyticsPeriods(days:number,now=new Date(),timeZone=ANALYTICS_TIME_ZONE){
  const [year,month,day]=zonedDateKey(now,timeZone).split("-").map(Number);
  const key=(offset:number)=>new Date(Date.UTC(year,month-1,day-offset)).toISOString().slice(0,10);
  const rangeStart=zonedMidnight(key(days-1),timeZone);
  const duration=now.getTime()-rangeStart.getTime();
  const todayStart=zonedMidnight(key(0),timeZone);
  const todayDuration=now.getTime()-todayStart.getTime();
  return {range:{from:rangeStart,to:now},previous:{from:new Date(rangeStart.getTime()-duration),to:rangeStart},today:{from:todayStart,to:now},yesterday:{from:new Date(todayStart.getTime()-864e5),to:new Date(todayStart.getTime()-864e5+todayDuration)}};
}
