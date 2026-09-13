"use client";
import {useEffect} from "react";

export function HomePageTracker(){
  useEffect(()=>{
    const body=JSON.stringify({eventId:crypto.randomUUID(),name:"page_view",schemaVersion:1,occurredAt:new Date().toISOString(),tracking:Object.fromEntries(new URLSearchParams(window.location.search)),dramaId:"",metadata:{page:"home"}});
    if(navigator.sendBeacon)navigator.sendBeacon("/api/events",new Blob([body],{type:"application/json"}));
    else void fetch("/api/events",{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true});
  },[]);
  return null;
}
