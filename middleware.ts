import { NextRequest,NextResponse } from "next/server";
export function middleware(request:NextRequest){const {pathname}=request.nextUrl;if(pathname==="/admin/login"||pathname.startsWith("/api/admin/auth/"))return NextResponse.next();const expected=process.env.ADMIN_SESSION_TOKEN;if(!expected||request.cookies.get("dc_admin")?.value!==expected){const login=new URL("/admin/login",request.url);login.searchParams.set("next",pathname);return NextResponse.redirect(login)}return NextResponse.next()}
export const config={matcher:["/admin/:path*","/api/admin/:path*"]};
