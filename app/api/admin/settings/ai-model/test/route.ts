import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {isAiModelId} from "@/lib/admin/ai-models";
import {getRuntimeSecret} from "@/lib/admin/runtime-secret-repository";

export const maxDuration=60;
const bodySchema=z.object({model:z.string().optional()});

export async function POST(request:NextRequest){
 try{
  const {model}=bodySchema.parse(await request.json());
  let id=model&&isAiModelId(model)?model:"";
  if(!id){const saved=await getRuntimeSecret("ai_model_config");id=saved&&isAiModelId(saved.value)?saved.value:""}
  if(!id||!id.startsWith("deepseek:"))return NextResponse.json({ok:false,message:"Choose a DeepSeek model to test."},{status:400});
  const key=process.env.DEEPSEEK_API_KEY;
  if(!key)return NextResponse.json({ok:false,message:"DEEPSEEK_API_KEY is not set in this Vercel environment."},{status:503});
  const providerModel=id.split(":")[1];
  const started=Date.now();
  const response=await fetch("https://api.deepseek.com/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:providerModel,messages:[{role:"user",content:"Reply with exactly: ok"}],max_tokens:1024,stream:false}),signal:AbortSignal.timeout(45_000)});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)return NextResponse.json({ok:false,status:response.status,error:payload,latencyMs:Date.now()-started},{status:502});
  const message=payload?.choices?.[0]?.message??{};
  return NextResponse.json({ok:true,model:id,reply:message.content||message.reasoning_content||"",latencyMs:Date.now()-started});
 }catch(error){
  if(error instanceof ZodError)return NextResponse.json({ok:false,message:"Invalid request body."},{status:400});
  return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Could not test AI model"},{status:503});
 }
}
