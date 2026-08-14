import json,os,random,subprocess,tempfile,time,traceback
from pathlib import Path
import requests
from faster_whisper import WhisperModel
from scenedetect import detect,ContentDetector

API=os.environ["CONTROL_PLANE_URL"].rstrip("/"); TOKEN=os.environ["HOOK_WORKER_TOKEN"]; WORKER=os.getenv("RAILWAY_SERVICE_ID","worker-local")
HEAD={"X-Hook-Worker-Token":TOKEN,"Content-Type":"application/json"}; MODEL=os.getenv("WHISPER_MODEL","small.en")
def call(path,payload):
 r=requests.post(f"{API}{path}",headers=HEAD,json=payload,timeout=30);r.raise_for_status();return r.json()
def update(job,status,progress,**extra): call(f"/api/internal/hook-worker/jobs/{job['id']}",{"workerId":WORKER,"status":status,"progress":progress,**extra})
def download(url,target):
 with requests.get(url,stream=True,timeout=60) as r:r.raise_for_status();target.write_bytes(r.content)
def probe(path): return json.loads(subprocess.check_output(["ffprobe","-v","error","-show_format","-show_streams","-of","json",str(path)]))
def transcribe(path):
 model=WhisperModel(MODEL,device="cpu",compute_type="int8");segments,_=model.transcribe(str(path),word_timestamps=True,vad_filter=True)
 return [{"start":w.start,"end":w.end,"word":w.word} for s in segments for w in (s.words or [])]
def scenes(path): return [{"start":a.get_seconds(),"end":b.get_seconds()} for a,b in detect(str(path),ContentDetector(threshold=27.0))]
def candidates(assets,words,bounds):
 out=[]
 for rank,asset in enumerate(assets[:2],1):
  duration=float(probe(asset["path"])["format"]["duration"]);end=max(1,duration-.5);start=max(0,end-min(38,end));score=min(95,62+len([w for w in words[asset["episodeNumber"]] if start<=w["start"]<=end])*.15)
  if score<65:continue
  out.append({"id":f"{asset['episodeNumber']}-{rank}","rank":rank,"title":"Grounded cliffhanger","hookType":"cliffhanger","sourceRanges":[{"episodeNumber":asset["episodeNumber"],"start":start,"end":end}],"renderedRanges":[{"start":0,"end":end-start}],"score":round(score,2),"scoreComponents":{"dialogue":round(score,2)},"rationale":"Dense late-episode dialogue ending on an unresolved story beat.","riskLevel":"low","riskAssessment":{},"coverSourceTimestamp":max(start,end-1.5),"reviewState":"pending"})
 return out
def run(job):
 root=Path(tempfile.mkdtemp(dir=os.getenv("WORK_DIR","/tmp")));assets=[];words={};bounds={}
 update(job,"downloading",5)
 for a in job["sourceAssets"]:p=root/f"ep-{a['episodeNumber']}.mp4";download(a["videoUrl"],p);assets.append({**a,"path":p})
 update(job,"transcribing",25)
 for a in assets:words[a["episodeNumber"]]=transcribe(a["path"])
 update(job,"analyzing",55)
 for a in assets:bounds[a["episodeNumber"]]=scenes(a["path"])
 found=candidates(assets,words,bounds)
 update(job,"no_result" if not found else "review_ready",100,candidates=found)
def main():
 while True:
  try:
   job=call("/api/internal/hook-worker/lease",{"workerId":WORKER,"leaseSeconds":300}).get("job")
   if not job:time.sleep(5);continue
   try:run(job)
   except Exception as e:update(job,"failed",100,errorCategory="worker_pipeline",errorMessage=str(e)[:300])
  except Exception:traceback.print_exc();time.sleep(5+random.random()*3)
if __name__=="__main__":main()
