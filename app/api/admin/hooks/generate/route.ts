import {NextResponse} from "next/server";
export async function POST(){return NextResponse.json({message:"Synchronous hook rendering was removed. Create an asynchronous job at /api/admin/hooks/jobs."},{status:410})}
