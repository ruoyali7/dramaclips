import {NextResponse} from "next/server";
export async function GET(){return NextResponse.json({message:"Legacy local drafts are disabled. Preview worker-managed candidates from their job record."},{status:410})}
