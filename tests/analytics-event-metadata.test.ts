import {describe,it,expect,vi} from "vitest";
const {record}=vi.hoisted(()=>({record:vi.fn()}));
vi.mock("@/lib/admin/analytics-repository",()=>({recordTrackingEvent:record}));
vi.mock("@/lib/admin/admin-session",()=>({isAdminRequest:()=>false}));
import {POST} from "@/app/api/events/route";
import {NextRequest} from "next/server";
describe("analytics event metadata",()=>{
 it("keeps only supported conversion metadata",async()=>{const request=new NextRequest("http://localhost/api/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId:"11111111-1111-4111-8111-111111111111",name:"promo_code_copy",schemaVersion:1,occurredAt:"2026-09-13T19:00:00.000Z",dramaId:"d",metadata:{reason:"manual",destination:"content_promotion",private:"drop"}})});expect((await POST(request)).status).toBe(202);expect(record.mock.calls[0][0].metadata).toMatchObject({reason:"manual",destination:"content_promotion"});expect(record.mock.calls[0][0].metadata).not.toHaveProperty("private");});
 it("accepts standard UTM attribution aliases",async()=>{record.mockClear();const request=new NextRequest("http://localhost/api/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId:"22222222-2222-4222-8222-222222222222",name:"page_view",schemaVersion:1,occurredAt:"2026-09-13T19:00:00.000Z",dramaId:"d",tracking:{utm_source:"Facebook",utm_campaign:"Fall-Launch",utm_content:"Clip-2"}})});expect((await POST(request)).status).toBe(202);expect(record.mock.calls[0][0]).toMatchObject({source:"facebook",campaign:"fall-launch",clip:"clip-2"});});
});
