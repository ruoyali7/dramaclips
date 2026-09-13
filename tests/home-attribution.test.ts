import {describe,it,expect} from "vitest";
import {trackingQuery} from "@/lib/tracking";
describe("homepage attribution links",()=>{
 it("retains bio attribution in generated query strings",()=>{expect(trackingQuery({s:"instagram",c:"bio",a:"instagram-bio",q:undefined})).toBe("s=instagram&c=bio&a=instagram-bio");});
});
