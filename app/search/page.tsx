import { redirect } from "next/navigation";
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){const {q}=await searchParams;redirect(q?`/?q=${encodeURIComponent(q)}#find-by-code`:"/#find-by-code")}
