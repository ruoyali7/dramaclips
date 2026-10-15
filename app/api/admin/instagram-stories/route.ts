import {NextResponse} from "next/server";
import {listInstagramStoryJobs} from "@/lib/admin/instagram-story-repository";
import {pacificCartDates} from "@/lib/publish-cart-date";

export async function GET(){
  try{return NextResponse.json({date:pacificCartDates()[0],jobs:await listInstagramStoryJobs({scheduleDate:pacificCartDates()[0],limit:8})});}
  catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not load Instagram Stories"},{status:503});}
}
