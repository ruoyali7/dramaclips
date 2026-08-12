import { NextRequest,NextResponse } from "next/server";
import { z,ZodError } from "zod";
import { createShortLink,listShortLinks } from "@/lib/admin/analytics-repository";
import { getDramaBySlug } from "@/lib/catalog";

const schema=z.object({dramaSlug:z.string().trim().min(1).max(120),source:z.enum(["x","instagram","youtube","facebook","tiktok"]),account:z.string().trim().max(100).optional(),campaign:z.string().trim().max(100).optional(),clip:z.string().trim().min(1).max(100)});
export async function GET(){try{return NextResponse.json({links:await listShortLinks()})}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not load links"},{status:503})}}
export async function POST(request:NextRequest){try{const input=schema.parse(await request.json());if(!await getDramaBySlug(input.dramaSlug))return NextResponse.json({message:"Published drama not found"},{status:404});return NextResponse.json({link:await createShortLink(input)},{status:201})}catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Check platform, drama, and Clip ID"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not create short link"},{status:503})}}
