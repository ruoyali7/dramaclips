import {describe,it,expect} from "vitest";
import {trackingQuery} from "@/lib/tracking";
describe("homepage attribution links",()=>{
 it("retains bio attribution in generated query strings",()=>{expect(trackingQuery({s:"instagram",c:"bio",a:"instagram-bio",q:undefined})).toBe("s=instagram&c=bio&a=instagram-bio");});
 it("retains UTM aliases and drops search and routing parameters",()=>{expect(trackingQuery({utm_source:"facebook",utm_campaign:"launch",q:"4251113",d:"featured"})).toBe("utm_source=facebook&utm_campaign=launch");});
});
