import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
const schema=z.object({name:z.enum(["episode_start","episode_complete","next_episode","promo_code_copy","watch_full_click"]),schemaVersion:z.literal(1),occurredAt:z.string().datetime(),dramaId:z.string().max(80)}).passthrough();
export async function POST(request:NextRequest){try{const event=schema.parse(await request.json());if(process.env.NODE_ENV==="development")console.info("[event]",event.name,event.dramaId);return new NextResponse(null,{status:202})}catch{return NextResponse.json({code:"INVALID_EVENT",message:"Invalid event payload"},{status:400})}}
