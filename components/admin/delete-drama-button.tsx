"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDramaButton({id,title}:{id:string;title:string}){const [deleting,setDeleting]=useState(false);const router=useRouter();async function remove(){if(!window.confirm(`Delete “${title}” from DramaClips?\n\nR2 files will be kept.`))return;setDeleting(true);const response=await fetch(`/api/admin/dramas/${id}`,{method:"DELETE"});if(!response.ok){setDeleting(false);window.alert("Drama could not be deleted.");return}router.push("/admin/dramas?deleted=1");router.refresh()}return <button className="delete-button" type="button" disabled={deleting} onClick={()=>void remove()}>{deleting?"Deleting…":"Delete"}</button>}
