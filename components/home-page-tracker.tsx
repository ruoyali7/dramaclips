"use client";
import {useEffect} from "react";
import { trackClientEvent } from "@/lib/client-events";

export function HomePageTracker(){
  useEffect(()=>{
    trackClientEvent("page_view",{dramaId:""});
  },[]);
  return null;
}
