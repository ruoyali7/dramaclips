import {beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));
const {listVizardSources,listPublishPackages,listInstagramStoryJobs,createInstagramStoryJobs,updateInstagramStoryJobSchedule}=vi.hoisted(()=>({
  listVizardSources:vi.fn(),listPublishPackages:vi.fn(),listInstagramStoryJobs:vi.fn(),createInstagramStoryJobs:vi.fn(),updateInstagramStoryJobSchedule:vi.fn(),
}));
vi.mock("./repository",()=>({listVizardSources}));
vi.mock("./publish-repository",()=>({listPublishPackages}));
vi.mock("./instagram-story-repository",()=>({listInstagramStoryJobs,createInstagramStoryJobs,updateInstagramStoryJobSchedule}));

import {createReconnectInstagramStoryPlan,listDueInstagramStoryJobs} from "./instagram-story-service";

function source(index:number){return {id:`id-${index}`,title:`Drama ${index}`,slug:`drama-${index}`,publicCode:`code-${index}`,promoCode:`promo-${index}`,coverUrl:`https://img.example/${index}.jpg`,contentPromotionUrl:`https://reelslink.com/cps/link${index}`,description:"",tags:[],language:"en",publishedAt:"2026-01-01",episodes:[]};}

describe("daily Instagram Story planning",()=>{
  beforeEach(()=>{vi.clearAllMocks();});

  it("selects three current Post dramas, two library dramas, and spaces them from reconnect time",async()=>{
    const now=new Date("2026-10-14T18:00:00.000Z");
    let created:Array<Record<string,unknown>>=[];
    listInstagramStoryJobs.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {drama_slug:"drama-4",published_at:"2026-10-12T18:00:00.000Z"},
      {drama_slug:"drama-5",published_at:"2026-09-01T18:00:00.000Z"},
    ]).mockImplementationOnce(async()=>created);
    createInstagramStoryJobs.mockImplementation(async rows=>{created=rows;return rows;});
    listVizardSources.mockResolvedValue(Array.from({length:10},(_,index)=>source(index+1)));
    listPublishPackages.mockResolvedValue([1,2,3].map(index=>({dramaSlug:`drama-${index}`,scheduledAt:`2026-10-14T${14+index}:00:00.000Z`,platforms:[{source:"instagram"}]})));

    const jobs=await createReconnectInstagramStoryPlan(now);

    expect(jobs).toHaveLength(5);
    expect(jobs.slice(0,3).map((job:{drama_slug:string;selection_source:string})=>[job.drama_slug,job.selection_source])).toEqual([
      ["drama-1","daily_post"],["drama-2","daily_post"],["drama-3","daily_post"],
    ]);
    expect(jobs.map((job:{drama_slug:string})=>job.drama_slug)).not.toContain("drama-4");
    expect(jobs.map((job:{scheduled_at:string})=>job.scheduled_at)).toEqual([
      "2026-10-14T18:10:00.000Z",
      "2026-10-14T20:10:00.000Z",
      "2026-10-14T22:10:00.000Z",
      "2026-10-15T00:10:00.000Z",
      "2026-10-15T02:10:00.000Z",
    ]);
  });

  it("reschedules an existing unstarted batch without selecting duplicates",async()=>{
    const existing=Array.from({length:5},(_,index)=>({id:`job-${index}`,status:"scheduled",scheduled_at:`2026-10-14T${16+index}:00:00.000Z`,drama_slug:`drama-${index}`}));
    listInstagramStoryJobs.mockResolvedValueOnce(existing).mockResolvedValueOnce(existing);

    const jobs=await createReconnectInstagramStoryPlan(new Date("2026-10-14T19:00:00.000Z"));

    expect(updateInstagramStoryJobSchedule).toHaveBeenCalledTimes(5);
    expect(updateInstagramStoryJobSchedule).toHaveBeenNthCalledWith(1,"job-0","2026-10-14T19:10:00.000Z","2026-10-14T19:00:00.000Z");
    expect(createInstagramStoryJobs).not.toHaveBeenCalled();
    expect(jobs).toHaveLength(5);
  });

  it("uses every eligible current Post slot and applies the cooldown to current Posts too",async()=>{
    const now=new Date("2026-10-14T18:00:00.000Z");
    let created:Array<Record<string,unknown>>=[];
    listInstagramStoryJobs.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {drama_slug:"drama-2",published_at:"2026-10-12T18:00:00.000Z"},
    ]).mockImplementationOnce(async()=>created);
    createInstagramStoryJobs.mockImplementation(async rows=>{created=rows;return rows;});
    listVizardSources.mockResolvedValue(Array.from({length:8},(_,index)=>source(index+1)));
    listPublishPackages.mockResolvedValue([1,2,3,4,5].map(index=>({dramaSlug:`drama-${index}`,scheduledAt:`2026-10-14T${12+index}:00:00.000Z`,platforms:[{source:"instagram"}]})));

    const jobs=await createReconnectInstagramStoryPlan(now);

    expect(jobs.map((job:{drama_slug:string})=>job.drama_slug)).toEqual(["drama-1","drama-3","drama-4","drama-5","drama-6"]);
    expect(jobs.slice(0,4).every((job:{selection_source:string})=>job.selection_source==="daily_post")).toBe(true);
    expect(jobs[4].selection_source).toBe("library");
  });

  it("returns only scheduled jobs that are already due",async()=>{
    listInstagramStoryJobs.mockResolvedValue([{id:"due-job"}]);
    await expect(listDueInstagramStoryJobs(new Date("2026-10-14T20:00:00.000Z"))).resolves.toEqual([{id:"due-job"}]);
    expect(listInstagramStoryJobs).toHaveBeenCalledWith({status:"scheduled",dueBefore:"2026-10-14T20:00:00.000Z",requireReconnect:true,limit:5});
  });
});
