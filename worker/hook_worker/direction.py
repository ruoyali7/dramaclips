import re

PARSER_VERSION="rule-v1"
SIGNAL_ALIASES={
 "conflict":{"conflict","fight","argument","betrayal","revenge","humiliation","冲突","争吵","背叛","复仇","羞辱"},
 "reversal":{"reversal","twist","truth","secret","misunderstanding","反转","真相","秘密","误会"},
 "tension":{"romantic","romance","chemistry","attraction","intimate","kiss","jealous","tutor","student","暧昧","性张力","亲密","接吻","嫉妒","师生","禁忌"},
 "danger":{"danger","threat","gun","knife","kidnap","危险","威胁","枪","刀","绑架"},
 "identity":{"identity","heir","ceo","real name","身份","继承人","总裁","真实姓名"},
 "cliffhanger":{"cliffhanger","unanswered","do not reveal","before the reveal","before it happens","悬念","不要揭露","揭晓前","完成之前","停在"},
}
MUST_MARKERS=("must include","must show","required:","必须包含","必须出现","一定要有")
AVOID_MARKERS=("avoid","do not include","do not","exclude","不要出现","不要","避免","禁止")

def _timestamp_seconds(value):
 parts=[int(part) for part in value.split(":")]
 return parts[0]*60+parts[1] if len(parts)==2 else parts[0]*3600+parts[1]*60+parts[2]

def _time_range(text):
 stamp=r"(?:\d{1,2}:)?\d{1,2}:\d{2}"
 between=re.search(f"({stamp})\\s*(?:-|–|—|to|至|到)\\s*({stamp})",text,re.I)
 if between:return {"start":_timestamp_seconds(between.group(1)),"end":_timestamp_seconds(between.group(2))}
 after=re.search(f"(?:from|after|从)?\\s*({stamp})\\s*(?:开始|之后|以后|onward|and after|after)",text,re.I)
 if after:return {"start":_timestamp_seconds(after.group(1)),"end":None}
 return None

def _clauses_after(text,markers):
 values=[]
 for marker in markers:
  for match in re.finditer(re.escape(marker),text,re.I):
   clause=text[match.end():].split(".",1)[0].split("。",1)[0].split(";",1)[0].strip(" :：,，")
   if clause:values.append(clause[:120].lower())
 return list(dict.fromkeys(values))

def parse_direction(value):
 original=(value or "").strip();lower=original.lower()
 signals=[name for name,aliases in SIGNAL_ALIASES.items() if any(alias in lower for alias in aliases)]
 ending="cliffhanger" if "cliffhanger" in signals else ""
 return {"original":original,"signals":signals,"mustInclude":_clauses_after(original,MUST_MARKERS),"avoid":_clauses_after(original,AVOID_MARKERS),"endingIntent":ending,"timeRange":_time_range(original),"parserVersion":PARSER_VERSION}

def score_direction(schema,text,parts,start=None,end=None):
 if not schema.get("original"):return {"score":None,"penalty":0,"eligible":True,"evidence":{"matched":[],"missing":[],"excluded":[]}}
 lower=text.lower();requested=schema.get("signals",[]);matched=[signal for signal in requested if parts.get(signal,0)>=20];missing=[signal for signal in requested if signal not in matched]
 must=schema.get("mustInclude",[]);must_matched=[term for term in must if term in lower];must_missing=[term for term in must if term not in lower]
 avoided=[term for term in schema.get("avoid",[]) if term in lower]
 signal_score=sum(parts.get(signal,0) for signal in requested)/max(1,len(requested)) if requested else 45
 term_score=100*len(must_matched)/max(1,len(must)) if must else 70
 score=round(signal_score*.72+term_score*.28,2);penalty=len(avoided)*45;time_range=schema.get("timeRange");midpoint=(start+end)/2 if start is not None and end is not None else None
 time_matched=not time_range or midpoint is not None and midpoint>=time_range["start"] and (time_range.get("end") is None or midpoint<=time_range["end"])
 supported=bool(requested or must or time_range);evidence_matched=matched+must_matched+(["requested time range"] if time_range and time_matched else []);evidence_missing=missing+must_missing+(["requested time range"] if time_range and not time_matched else [])
 return {"score":score,"penalty":penalty,"eligible":supported and score>=28 and not avoided and not must_missing and time_matched,"evidence":{"matched":evidence_matched,"missing":evidence_missing,"excluded":avoided}}
