import re

SIGNALS={
 "conflict":{"liar","lie","hate","never","stop","leave","kill","fight","betray","cheat","enemy","revenge","ruined","fault"},
 "reversal":{"but","actually","truth","secret","real","remember","wait","impossible","instead","however","found out"},
 "tension":{"kiss","love","want","touch","bed","naked","beautiful","jealous","marry","date","boyfriend","girlfriend","tutor"},
 "danger":{"blood","gun","knife","die","dead","hurt","danger","threat","kidnap","police"},
 "identity":{"father","mother","brother","sister","heir","ceo","king","queen","real name","identity"},
}
RISK_WORDS={"naked","nude","sex","fuck","bitch","bastard","kill","blood","gun"}

def normalized_words(words,start,end):
 return [token for w in words if start<=float(w["start"])<=end for token in re.findall(r"[a-z0-9']+|[?]",str(w["word"]).lower())]

def snap_windows(words,scenes,duration,min_seconds=20,max_seconds=42):
 endings=sorted({min(duration-.35,max(1,float(s["end"]))) for s in scenes} | {max(1,duration-.5)})
 starts=sorted({max(0,float(s["start"])) for s in scenes} | {0})
 windows=[]
 for end in endings:
  eligible=[start for start in starts if min_seconds<=end-start<=max_seconds]
  start=max(eligible) if eligible else max(0,end-min(38,end))
  if end-start>=min_seconds*.7:windows.append((round(start,3),round(end,3)))
 return windows

def lexical_components(tokens,duration,end,episode_duration):
 text=" ".join(tokens);count=max(1,len(tokens));signal={name:min(100,100*sum(text.count(term) for term in terms)/max(2,count*.045)) for name,terms in SIGNALS.items()}
 dialogue=min(100,count/max(1,duration)*18);question=100 if "?" in text or tokens[-1:] and tokens[-1] in {"why","what","who","how","really"} else 0
 cliffhanger=min(100,45*max(0,1-(episode_duration-end)/20)+question*.55);context=min(100,35+min(count,90)*.65)
 risk_hits=sum(text.count(term) for term in RISK_WORDS);risk="high" if risk_hits>=4 else "medium" if risk_hits>=2 else "low"
 return {"dialogue":dialogue,"conflict":signal["conflict"],"reversal":signal["reversal"],"tension":signal["tension"],"danger":signal["danger"],"identity":signal["identity"],"cliffhanger":cliffhanger,"context":context},risk

def total_score(parts):
 return sum(parts.get(k,0)*w for k,w in {"dialogue":.16,"conflict":.15,"reversal":.13,"tension":.14,"danger":.08,"identity":.07,"cliffhanger":.15,"context":.05,"visual":.07}.items())

def jaccard(a,b):
 aa=set(re.findall(r"[a-z0-9']+",a.lower()));bb=set(re.findall(r"[a-z0-9']+",b.lower()));return len(aa&bb)/max(1,len(aa|bb))

def select_ranked(raw,limit=2,threshold=22):
 chosen=[]
 for item in sorted(raw,key=lambda x:x["score"],reverse=True):
  if item["score"]<threshold:continue
  duplicate=any(item["episodeNumber"]==old["episodeNumber"] and max(0,min(item["end"],old["end"])-max(item["start"],old["start"]))/max(1,min(item["end"]-item["start"],old["end"]-old["start"]))>.55 or jaccard(item["text"],old["text"])>.72 for old in chosen)
  if not duplicate:chosen.append(item)
  if len(chosen)>=limit:break
 return chosen
