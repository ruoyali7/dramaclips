import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {getCoverPost,scheduleCoverPostStory} from "@/lib/admin/cover-post-repository";
import {snapIsoToTenMinutes} from "@/lib/publish-time";
import {reelShortUrl} from "@/lib/instagram-story";

const schema=z.object({deliveryMode:z.enum(["now","scheduled"]),scheduledAt:z.string().datetime().transform(snapIsoToTenMinutes).optional()})
 .refine(value=>value.deliveryMode!=="scheduled"||Boolean(value.scheduledAt),{message:"Scheduled Story publishing requires a time"})
 .refine(value=>value.deliveryMode!=="scheduled"||new Date(value.scheduledAt!).getTime()>Date.now(),{message:"Choose a scheduled time in the future"});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const input=schema.parse(await request.json());const {id}=await params;const post=await getCoverPost(id);if(!post||post.platform!=="instagram")return NextResponse.json({message:"Instagram poster draft not found"},{status:404});const targetUrl=reelShortUrl(post.caption||"");if(!targetUrl)return NextResponse.json({message:"Add a valid reelslink.com URL to the Instagram caption before scheduling the Story"},{status:400});return NextResponse.json({post:await scheduleCoverPostStory(id,{targetUrl,scheduledAt:input.deliveryMode==="scheduled"?input.scheduledAt:undefined})})}catch(error){if(error instanceof ZodError)return NextResponse.json({message:error.issues[0]?.message||"Check the Story schedule"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not schedule Story"},{status:503})}}
