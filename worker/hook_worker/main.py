import json,os,random,subprocess,tempfile,time,traceback
from pathlib import Path
import requests
from faster_whisper import WhisperModel
from scenedetect import detect,ContentDetector

API=os.environ["CONTROL_PLANE_URL"].rstrip("/"); TOKEN=os.environ["HOOK_WORKER_TOKEN"]; WORKER=os.getenv("RAILWAY_SERVICE_ID","worker-local")
HEAD={"X-Hook-Worker-Token":TOKEN,"Content-Type":"application/json"}; BYPASS=os.getenv("VERCEL_AUTOMATION_BYPASS_SECRET")
if BYPASS: HEAD["X-Vercel-Protection-Bypass"]=BYPASS
MODEL=os.getenv("WHISPER_MODEL","small.en")
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
def render(asset,candidate,target,cover_duration=.2):
 source=asset["path"];rng=candidate["sourceRanges"][0];cover=target.with_suffix(".cover.jpg")
 subprocess.check_call(["ffmpeg","-y","-ss",str(candidate["coverSourceTimestamp"]),"-i",str(source),"-frames:v","1","-q:v","2",str(cover)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 duration=rng["end"]-rng["start"];total=duration+cover_duration
 vf="scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
 graph=f"[0:v]{vf},trim=duration={cover_duration},setpts=PTS-STARTPTS[cv];[1:v]{vf},setpts=PTS-STARTPTS[mv];[cv][mv]concat=n=2:v=1:a=0[v];[1:a]asetpts=PTS-STARTPTS,apad=pad_dur={cover_duration}[a]"
 subprocess.check_call(["ffmpeg","-y","-loop","1","-framerate","30","-t",str(cover_duration),"-i",str(cover),"-ss",str(rng["start"]),"-to",str(rng["end"]),"-i",str(source),"-filter_complex",graph,"-map","[v]","-map","[a]","-t",str(total),"-c:v","libx264","-preset","medium","-crf","20","-force_key_frames","0","-c:a","aac","-b:a","160k","-movflags","+faststart",str(target)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 frame0=target.with_suffix(".frame0.jpg");subprocess.check_call(["ffmpeg","-y","-i",str(target),"-frames:v","1","-q:v","2",str(frame0)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 info=probe(target);video=next(s for s in info["streams"] if s["codec_type"]=="video");audio=next((s for s in info["streams"] if s["codec_type"]=="audio"),{})
 qa={"frameZeroExtracted":frame0.exists() and frame0.stat().st_size>5000,"durationWithinTolerance":abs(float(info["format"]["duration"])-total)<.35,"portrait1080x1920":video.get("width")==1080 and video.get("height")==1920}
 if not all(qa.values()):raise RuntimeError(f"Render QA failed: {qa}")
 return {"durationSeconds":round(float(info["format"]["duration"]),2),"width":video["width"],"height":video["height"],"videoCodec":video["codec_name"],"audioCodec":audio.get("codec_name","none"),"sizeBytes":target.stat().st_size,"qaResults":qa}
def upload_draft(job,candidate,path):
 prepared=call("/api/internal/hook-worker/uploads",{"jobId":job["id"],"workerId":WORKER,"rank":candidate["rank"],"sizeBytes":path.stat().st_size})
 with path.open("rb") as body:r=requests.put(prepared["uploadUrl"],data=body,headers={"Content-Type":"video/mp4","Content-Length":str(path.stat().st_size)},timeout=600);r.raise_for_status()
 return prepared
def run(job):
 root=Path(tempfile.mkdtemp(dir=os.getenv("WORK_DIR","/tmp")));assets=[];words={};bounds={}
 update(job,"downloading",5)
 for a in job["sourceAssets"]:p=root/f"ep-{a['episodeNumber']}.mp4";download(a["videoUrl"],p);assets.append({**a,"path":p})
 update(job,"transcribing",25)
 for a in assets:words[a["episodeNumber"]]=transcribe(a["path"])
 update(job,"analyzing",55)
 for a in assets:bounds[a["episodeNumber"]]=scenes(a["path"])
 found=candidates(assets,words,bounds)
 if found:
  update(job,"rendering",70)
  by_episode={a["episodeNumber"]:a for a in assets}
  for index,candidate in enumerate(found):
   output=root/f"hook-{candidate['rank']}.mp4";meta=render(by_episode[candidate["sourceRanges"][0]["episodeNumber"]],candidate,output,float(job.get("settings",{}).get("coverDuration",.2)))
   uploaded=upload_draft(job,candidate,output);candidate.update(meta);candidate["draftObjectKey"]=uploaded["objectKey"];candidate["draftUrl"]=uploaded["publicUrl"]
   update(job,"rendering",80+index*10)
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
