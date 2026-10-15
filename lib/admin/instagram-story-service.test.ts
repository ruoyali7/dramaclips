import {beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));
const {listVizardSources,listPublishPackages,listInstagramStoryJobs,createInstagramStoryJobs}=vi.hoisted(()=>({
  listVizardSources:vi.fn(),listPublishPackages:vi.fn(),listInstagramStoryJobs:vi.fn(),createInstagramStoryJobs:vi.fn(),
}));
vi.mock("./repository",()=>({listVizardSources}));
vi.mock("./publish-repository",()=>({listPublishPackages}));
vi.mock("./instagram-story-repository",()=>({listInstagramStoryJobs,createInstagramStoryJobs}));

import {ensureDailyInstagramStoryPlan} from "./instagram-story-service";

function source(index:number){return {id:`id-${index}`,title:`Drama ${index}`,slug:`drama-${index}`,publicCode:`code-${index}`,promoCode:`promo-${index}`,coverUrl:`https://img.example/${index}.jpg`,contentPromotionUrl:`https://reelslink.com/cps/link${index}`,description:"",tags:[],language:"en",publishedAt:"2026-01-01",episodes:[]};}

describe("daily Instagram Story planning",()=>{
  beforeEach(()=>{vi.clearAllMocks();createInstagramStoryJobs.mockImplementation(async rows=>rows);});

  it("selects three current Post dramas and fills five cooled-down library slots",async()=>{
    const now=new Date("2026-10-14T18:00:00.000Z");
    listInstagramStoryJobs.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {drama_slug:"drama-4",published_at:"2026-10-12T18:00:00.000Z"},
      {drama_slug:"drama-5",published_at:"2026-09-01T18:00:00.000Z"},
    ]);
    listVizardSources.mockResolvedValue(Array.from({length:10},(_,index)=>source(index+1)));
    listPublishPackages.mockResolvedValue([1,2,3].map(index=>({dramaSlug:`drama-${index}`,scheduledAt:`2026-10-14T${14+index}:00:00.000Z`,platforms:[{source:"instagram"}]})));

    const jobs=await ensureDailyInstagramStoryPlan(now);

    expect(jobs).toHaveLength(8);
    expect(jobs.slice(0,3).map((job:{drama_slug:string;selection_source:string})=>[job.drama_slug,job.selection_source])).toEqual([
      ["drama-1","daily_post"],["drama-2","daily_post"],["drama-3","daily_post"],
    ]);
    expect(jobs.map((job:{drama_slug:string})=>job.drama_slug)).not.toContain("drama-4");
    expect(new Set(jobs.map((job:{scheduled_at:string})=>job.scheduled_at))).toEqual(new Set(["2026-10-14T15:30:00.000Z"]));
  });
});
