import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createCoverPost, listCoverPosts } from "@/lib/admin/cover-post-repository";
import { getDramaBySlug } from "@/lib/catalog";
const schema = z.object({ dramaSlug: z.string().trim().min(1).max(120), platform: z.enum(["facebook", "instagram"]), imageUrl: z.string().url(), contentCode: z.string().trim().min(1).max(40), caption: z.string().max(10000) });
export async function GET() { try { return NextResponse.json({ posts: await listCoverPosts() }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Could not load cover posts" }, { status: 503 }); } }
export async function POST(request: NextRequest) { try { const input = schema.parse(await request.json()); if (!await getDramaBySlug(input.dramaSlug)) return NextResponse.json({ message: "Published drama not found" }, { status: 404 }); return NextResponse.json({ post: await createCoverPost(input) }, { status: 201 }); } catch (error) { if (error instanceof ZodError) return NextResponse.json({ message: "Check the drama, platform, code, and caption" }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : "Could not save cover post" }, { status: 503 }); } }
