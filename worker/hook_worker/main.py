import json,os,random,shutil,subprocess,tempfile,time,traceback
from pathlib import Path
import requests
import cv2
from faster_whisper import WhisperModel
from scenedetect import detect,ContentDetector
from .scoring import lexical_components,normalized_words,select_ranked,snap_windows,total_score
from .direction import parse_direction,score_direction

API=os.environ["CONTROL_PLANE_URL"].rstrip("/"); TOKEN=os.environ["HOOK_WORKER_TOKEN"]; WORKER=os.getenv("RAILWAY_SERVICE_ID","worker-local")
HEAD={"X-Hook-Worker-Token":TOKEN,"Content-Type":"application/json"}; BYPASS=os.getenv("VERCEL_AUTOMATION_BYPASS_SECRET")
if BYPASS: HEAD["X-Vercel-Protection-Bypass"]=BYPASS
MODEL=os.getenv("WHISPER_MODEL","small.en")
def cleanup_worker_temps(max_age=3600):
 root=Path(os.getenv("WORK_DIR","/tmp"));cutoff=time.time()-max_age
 for prefix in ("drama-hook-","drama-publish-","drama-yixer-"):
  for path in root.glob(f"{prefix}*"):
   try:
    if path.is_dir() and path.stat().st_mtime<cutoff:shutil.rmtree(path)
   except OSError:pass
def call(path,payload):
 r=requests.post(f"{API}{path}",headers=HEAD,json=payload,timeout=60);r.raise_for_status();return r.json()
def update(job,status,progress,**extra): call(f"/api/internal/hook-worker/jobs/{job['id']}",{"workerId":WORKER,"status":status,"progress":progress,**extra})
def download(url,target):
 with requests.get(url,stream=True,timeout=60) as r:r.raise_for_status();target.write_bytes(r.content)
def probe(path): return json.loads(subprocess.check_output(["ffprobe","-v","error","-show_format","-show_streams","-of","json",str(path)]))
def transcribe(path):
 model=WhisperModel(MODEL,device="cpu",compute_type="int8");segments,_=model.transcribe(str(path),word_timestamps=True,vad_filter=True)
 return [{"start":w.start,"end":w.end,"word":w.word} for s in segments for w in (s.words or [])]
def scenes(path): return [{"start":a.get_seconds(),"end":b.get_seconds()} for a,b in detect(str(path),ContentDetector(threshold=27.0))]
def visual_stats(path,start,end):
 cap=cv2.VideoCapture(str(path));cascade=None;samples=[]
 if hasattr(cv2,"CascadeClassifier") and hasattr(cv2,"data"):
  candidate=cv2.CascadeClassifier(cv2.data.haarcascades+"haarcascade_frontalface_default.xml");cascade=None if candidate.empty() else candidate
 for stamp in [start+1.0,start+(end-start)*.35,start+(end-start)*.62,max(start,end-1.0)]:
  cap.set(cv2.CAP_PROP_POS_MSEC,stamp*1000);ok,frame=cap.read()
  if not ok:continue
  gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY);sharp=min(100,cv2.Laplacian(gray,cv2.CV_64F).var()/4);brightness=float(gray.mean());exposure=max(0,100-abs(brightness-125)*1.15);faces=[] if cascade is None else cascade.detectMultiScale(gray,1.15,5,minSize=(48,48));face=min(100,len(faces)*55)
  score=sharp*.55+exposure*.30+face*.15;samples.append((score,stamp,{"sharpness":round(sharp,2),"exposure":round(exposure,2),"faces":len(faces),"faceDetectorAvailable":cascade is not None}))
 cap.release()
 if not samples:return {"score":0,"cover":max(start,end-1),"details":{}}
 best=max(samples,key=lambda item:item[0]);return {"score":round(sum(item[0] for item in samples)/len(samples),2),"cover":round(best[1],3),"details":best[2]}
def candidates(assets,words,bounds,direction_schema):
 raw=[]
 for asset in assets:
  episode=asset["episodeNumber"];duration=float(probe(asset["path"])["format"]["duration"])
  episode_raw=[]
  for start,end in snap_windows(words[episode],bounds[episode],duration):
   tokens=normalized_words(words[episode],start,end)
   if len(tokens)>=10:
    parts,risk=lexical_components(tokens,end-start,end,duration);text=" ".join(tokens)
   else:
    tail=max(0,1-(duration-end)/20)
    parts={"dialogue":35,"conflict":0,"reversal":0,"tension":0,"danger":0,"identity":0,"cliffhanger":55+45*tail,"context":60};risk="low";text=f"visual-scene-episode-{episode}-{start}-{end}"
   direction=score_direction(direction_schema,text,parts);parts["visual"]=0;parts["directionMatch"]=direction["score"] or 0;score=total_score(parts)+(direction["score"] or 0)*.28-direction["penalty"]
   if direction["eligible"] or not direction_schema.get("original"):episode_raw.append({"episodeNumber":episode,"start":start,"end":end,"text":text,"score":score,"parts":parts,"risk":risk,"path":asset["path"],"direction":direction})
  raw.extend(sorted(episode_raw,key=lambda item:item["score"],reverse=True)[:3])
 for item in raw:
  visual=visual_stats(item.pop("path"),item["start"],item["end"]);item["visual"]=visual;item["parts"]["visual"]=visual["score"];item["score"]=total_score(item["parts"])+(item["direction"]["score"] or 0)*.28-item["direction"]["penalty"]
 ranked=select_ranked(raw,2);out=[]
 if not ranked:
  for asset in assets[:2]:
   duration=float(probe(asset["path"])["format"]["duration"]);end=max(1,duration-.35);start=max(0,end-min(38,end));visual=visual_stats(asset["path"],start,end)
   parts={"dialogue":35,"conflict":0,"reversal":0,"tension":0,"danger":0,"identity":0,"cliffhanger":100,"context":60,"visual":visual["score"]}
   direction=score_direction(direction_schema,f"last-scene-{asset['episodeNumber']}",parts)
   if direction["eligible"] or not direction_schema.get("original"):ranked.append({"episodeNumber":asset["episodeNumber"],"start":start,"end":end,"text":f"last-scene-{asset['episodeNumber']}","score":total_score(parts)+(direction["score"] or 0)*.28-direction["penalty"],"parts":parts,"risk":"low","visual":visual,"direction":direction})
 for rank,item in enumerate(ranked,1):
  dominant=max((key for key in ("conflict","reversal","tension","danger","identity","cliffhanger")),key=lambda key:item["parts"][key]);labels={"conflict":"Conflict confrontation","reversal":"Truth revealed","tension":"Romantic tension","danger":"Immediate danger","identity":"Identity reveal","cliffhanger":"Grounded cliffhanger"}
  direction=item.get("direction",{"score":None,"evidence":{"matched":[],"missing":[],"excluded":[]}});match_text=f" Direction evidence: {', '.join(direction['evidence']['matched'])}." if direction.get("score") is not None else ""
  out.append({"id":f"{item['episodeNumber']}-{rank}","rank":rank,"title":labels[dominant],"hookType":dominant,"sourceRanges":[{"episodeNumber":item["episodeNumber"],"start":item["start"],"end":item["end"]}],"renderedRanges":[{"start":0,"end":item["end"]-item["start"]}],"score":round(item["score"],2),"scoreComponents":{key:round(value,2) for key,value in item["parts"].items()},"rationale":f"Selected for {dominant}, dense grounded dialogue, and a sharp readable cover frame.{match_text}","riskLevel":item["risk"],"riskAssessment":{"keywordHeuristic":item["risk"],"coverFrame":item["visual"]["details"]},"directionMatchScore":direction.get("score"),"directionEvidence":direction["evidence"],"coverSourceTimestamp":item["visual"]["cover"],"reviewState":"pending"})
 return out
def render(asset,candidate,target,cover_duration=.1):
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
 root=Path(tempfile.mkdtemp(prefix="drama-hook-",dir=os.getenv("WORK_DIR","/tmp")));assets=[];words={};bounds={}
 update(job,"downloading",5)
 for a in job["sourceAssets"]:p=root/f"ep-{a['episodeNumber']}.mp4";download(a["videoUrl"],p);assets.append({**a,"path":p})
 update(job,"transcribing",25)
 for a in assets:words[a["episodeNumber"]]=transcribe(a["path"])
 update(job,"analyzing",55)
 for a in assets:bounds[a["episodeNumber"]]=scenes(a["path"])
 direction_schema=parse_direction(job.get("creativeDirection") or job.get("settings",{}).get("creativeDirection", ""));found=candidates(assets,words,bounds,direction_schema)
 if found:
  update(job,"rendering",70)
  by_episode={a["episodeNumber"]:a for a in assets}
  for index,candidate in enumerate(found):
   output=root/f"hook-{candidate['rank']}.mp4";meta=render(by_episode[candidate["sourceRanges"][0]["episodeNumber"]],candidate,output,float(job.get("settings",{}).get("coverDuration",.1)))
   uploaded=upload_draft(job,candidate,output);candidate.update(meta);candidate["draftObjectKey"]=uploaded["objectKey"];candidate["draftUrl"]=uploaded["publicUrl"]
   update(job,"rendering",80+index*10)
 update(job,"no_result" if not found else "review_ready",100,candidates=found,directionSchema=direction_schema)
class PublishCanceled(Exception):pass
def cancel_requested(response):
 package=(response or {}).get("package") or {};control=((package.get("yixiaoerResults") or {}).get("_control") or {})
 return bool(control.get("cancelRequested"))
def cli_output(command,env,timeout,secret,heartbeat=None):
 process=subprocess.Popen(command,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);deadline=time.time()+timeout
 while True:
  try:
   raw,_=process.communicate(timeout=min(10,max(1,deadline-time.time())))
   if process.returncode:
    detail=(raw or b"").decode("utf-8","replace").replace(secret,"[REDACTED]").strip();raise RuntimeError(f"Yixiaoer CLI failed: {detail or 'command exited unsuccessfully'}")
   return raw
  except subprocess.TimeoutExpired:
   if time.time()>=deadline:
    process.kill();process.communicate();raise RuntimeError("Yixiaoer CLI timed out")
   if heartbeat and heartbeat():
    process.terminate()
    try:process.wait(timeout=5)
    except subprocess.TimeoutExpired:process.kill();process.wait()
    raise PublishCanceled("Canceled by user")
def yxer(job,args,heartbeat=None):
 env={**os.environ,"HOME":"/work","YIXIAOER_API_KEY":job["apiKey"],"YIXIAOER_CONFIG":f"/tmp/yxer-{job['id']}.json"}
 cli_output(["yxer","config","set-api-key",job["apiKey"],"--json"],env,60,job["apiKey"])
 raw=cli_output(["yxer",*args,"--json"],env,900,job["apiKey"],heartbeat)
 parsed=json.loads(raw)
 if not parsed.get("ok"):raise RuntimeError((parsed.get("error") or {}).get("message") or "Yixiaoer command failed")
 return parsed.get("data")
def publish_update(job,status,progress,terminal=False,**extra):return call(f"/api/internal/publish-worker/jobs/{job['id']}",{"workerId":WORKER,"status":status,"progress":progress,"terminal":terminal,**extra})
def yixer_video(data):
 if not isinstance(data,dict):raise RuntimeError("Yixiaoer upload returned no resource")
 candidate=data.get("resource") or data.get("file") or data.get("upload") or data
 if not candidate.get("key"):raise RuntimeError("Yixiaoer upload returned no resource key")
 return candidate
def yixer_payload(job,pack,video,cover):
 platform={"tiktok":"TikTok","instagram":"Instagram","youtube":"Youtube","facebook":"Facebook"}[pack["source"]];caption=pack["caption"];title=f"{job['dramaTitle']} · EP {job['episodeNumber']}";content={"formType":"task"}
 if pack["source"]=="youtube":content.update({"title":title[:100],"description":caption[:5000],"tags":["Shorts","DramaClips","ShortDrama"],"category":"22","license":"youtube","embeddable":True,"madeForKids":False,"visible":"public","containsSyntheticMedia":False,"fps":10})
 if pack["source"]=="tiktok":content.update({"description":caption[:2200],"visible":"public","comment":True,"stitch":True,"duet":True,"aigc":False,"business":False,"yourOwn":False,"collaborative":False,"fps":10,"isAdVideo":False})
 if pack["source"]=="facebook":content.update({"title":title[:128],"description":caption[:2048]})
 if pack["source"]=="instagram":content.update({"description":caption[:2200],"share_to_feed":True})
 return {"action":"publish","publishType":"video","platforms":[platform],"publishChannel":"cloud","desc":title,"publishArgs":{"video":video,"accountForms":[{"platformAccountId":job["yixiaoerAccounts"][pack["source"]],"platformName":platform,"video":video,"cover":cover,"coverKey":cover["key"],"contentPublishForm":content}]}}
def yixer_file(job,payload,platform,command,dry=False,heartbeat=None):
 root=Path(tempfile.mkdtemp(prefix="drama-yixer-",dir=os.getenv("WORK_DIR","/tmp")));path=root/"payload.json";path.write_text(json.dumps(payload));name={"tiktok":"TikTok","instagram":"Instagram","youtube":"Youtube","facebook":"Facebook"}[platform]
 args=[command,"video",name,str(path),"--publish-channel","cloud"] if command=="publish" else [command,name,"video",str(path),"--publish-channel","cloud"]
 if dry:args.append("--dry-run")
 return yxer(job,args,heartbeat)
def download_publish_video(job,status,results):
 root=Path(tempfile.mkdtemp(prefix="drama-publish-",dir=os.getenv("WORK_DIR","/tmp")));target=root/"publish-video.mp4";started=time.time();started_at=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime(started))
 with requests.get(job["videoUrl"],stream=True,timeout=(30,120)) as response:
  response.raise_for_status();total=int(response.headers.get("content-length") or 0);received=0
  with target.open("wb") as output:
   for chunk in response.iter_content(chunk_size=1024*1024):
    if not chunk:continue
    output.write(chunk);received+=len(chunk);progress=5+int(received/max(1,total)*20) if total else 10
    operation={"stage":"downloading_from_r2","startedAt":started_at,"heartbeatAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"elapsedSeconds":int(time.time()-started),"bytesReceived":received,"bytesTotal":total}
    if cancel_requested(publish_update(job,status,min(25,progress),results={**results,"_operation":operation})):raise PublishCanceled("Canceled by user")
 return target
def run_publish(job):
 action=job["yixiaoerAction"];status="validating" if action=="validate" else "publishing";stored=job.get("yixiaoerVideo") or {};video=stored.get("video") or (stored if stored.get("key") else {});cover=stored.get("cover") or {};results=job.get("yixiaoerResults") or {};local_video=None
 if not video.get("duration") or not cover:
  local_video=download_publish_video(job,status,results)
 if not video.get("duration"):
  started=time.time();started_at=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime(started))
  def upload_heartbeat():
   operation={"stage":"uploading_to_yixiaoer","startedAt":started_at,"heartbeatAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"elapsedSeconds":int(time.time()-started)}
   return cancel_requested(publish_update(job,status,30,results={**results,"_operation":operation}))
  if upload_heartbeat():raise PublishCanceled("Canceled by user")
  video=yixer_video(yxer(job,["upload","--file",str(local_video),"--bucket","cloud-publish","--auto-meta"],upload_heartbeat))
 if not cover:
  cover_path=local_video.with_name("publish-cover.jpg");subprocess.check_call(["ffmpeg","-y","-ss","0","-i",str(local_video),"-frames:v","1","-q:v","2",str(cover_path)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  def cover_heartbeat():return cancel_requested(publish_update(job,status,33,results={**results,"_operation":{"stage":"uploading_cover_to_yixiaoer","heartbeatAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())}}))
  if cover_heartbeat():raise PublishCanceled("Canceled by user")
  cover=yixer_video(yxer(job,["upload","--file",str(cover_path),"--bucket","cloud-publish","--auto-meta"],cover_heartbeat))
 assets={"video":video,"cover":cover};publish_update(job,status,35,video=assets,results={**results,"_operation":{"stage":"preparing_platform_validation","heartbeatAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())}})
 payloads={pack["source"]:yixer_payload(job,pack,video,cover) for pack in job["platforms"] if pack["source"] in ("tiktok","instagram","youtube","facebook")}
 pending=[p for p in job["platforms"] if p["source"] in payloads and not (action=="publish" and isinstance(results.get(p["source"]),dict) and results[p["source"]].get("publish"))]
 for index,pack in enumerate(pending):
  source=pack["source"];platform_progress=40+int(index/max(1,len(pending))*45)
  def platform_heartbeat():return cancel_requested(publish_update(job,status,platform_progress,video=assets,payloads=payloads,results={**results,"_operation":{"stage":"validating_platform","platform":source,"heartbeatAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())}}))
  if platform_heartbeat():raise PublishCanceled("Canceled by user")
  checked={"validation":yixer_file(job,payloads[source],source,"validate",heartbeat=platform_heartbeat),"preview":yixer_file(job,payloads[source],source,"publish",True,platform_heartbeat)}
  if action=="publish":checked["publish"]=yixer_file(job,payloads[source],source,"publish",heartbeat=platform_heartbeat)
  results[source]=checked;publish_update(job,status,45+int((index+1)/max(1,len(pending))*45),video=assets,payloads=payloads,results=results)
 publish_update(job,"ready" if action=="validate" else "published",100,terminal=True,video=assets,payloads=payloads,results=results)
def main():
 cleanup_worker_temps(0)
 while True:
  try:
   worked=False;job=call("/api/internal/hook-worker/lease",{"workerId":WORKER,"leaseSeconds":300}).get("job")
   if job:
    worked=True
    try:run(job)
    except Exception as e:update(job,"failed",100,errorCategory="worker_pipeline",errorMessage=str(e)[:300])
   publish_job=call("/api/internal/publish-worker/lease",{"workerId":WORKER,"leaseSeconds":900}).get("job")
   if publish_job:
    worked=True
    try:run_publish(publish_job)
    except Exception as e:publish_update(publish_job,"failed",100,terminal=True,error=str(e)[:900])
   cleanup_worker_temps()
   if not worked:time.sleep(5)
  except Exception:traceback.print_exc();time.sleep(5+random.random()*3)
if __name__=="__main__":main()
