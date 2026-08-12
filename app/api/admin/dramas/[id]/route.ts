import { NextRequest,NextResponse } from "next/server";
import { ZodError } from "zod";
import { dramaUpdateSchema } from "@/lib/admin/drama-schema";
import { deleteDrama,updateDrama } from "@/lib/admin/repository";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const input=dramaUpdateSchema.parse(await request.json());return NextResponse.json({draft:await updateDrama(id,input)})}catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Check the form fields",fieldErrors:error.flatten().fieldErrors},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not update drama"},{status:400})}}
export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;await deleteDrama(id);return new NextResponse(null,{status:204})}catch{return NextResponse.json({message:"Drama could not be deleted"},{status:404})}}
