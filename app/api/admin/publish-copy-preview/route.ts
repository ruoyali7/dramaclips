import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {getDramaBySlug} from "@/lib/catalog";
import {preparePublishingCopy,publishingPlatforms} from "@/lib/admin/publish-repository";

const schema=z.object({dramaSlug:z.string().min(1),episodeNumber:z.number().int().positive(),videoKind:z.enum(["original","hook","upload"]),videoLabel:z.string().max(120).optional(),account:z.string().max(100).optional(),campaign:z.string().max(100).optional(),platforms:z.array(z.enum(publishingPlatforms)).min(1).max(5)});

export async function POST(request:NextRequest){try{const input=schema.parse(await request.json());const drama=await getDramaBySlug(input.dramaSlug);if(!drama)return NextResponse.json({message:"Published drama not found"},{status:404});const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;return NextResponse.json({platforms:await preparePublishingCopy({...input,title:drama.title,promoCode:drama.promoCode||drama.publicCode,description:drama.description,tags:drama.tags,siteUrl})})}catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Check the selected video and platforms"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not generate copy"},{status:503})}}
