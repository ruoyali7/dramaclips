import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));

import {triggerRailwayWorker} from "@/lib/admin/railway-worker-trigger";

const fetchMock=vi.fn();
const token="project-token";

function jsonResponse(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
}

function configure(){
  vi.stubEnv("RAILWAY_TRIGGER_TOKEN",token);
  vi.stubEnv("RAILWAY_PROJECT_ID","project-id");
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID","environment-id");
  vi.stubEnv("RAILWAY_SERVICE_ID","service-id");
}

function deploymentResponse(deploymentStopped:boolean){
  return {data:{deployments:{edges:[{node:{id:"deployment-1",status:deploymentStopped?"SLEEPING":"SUCCESS",deploymentStopped}}]}}};
}

describe("Railway worker trigger",()=>{
  beforeEach(()=>{
    fetchMock.mockReset();
    vi.stubGlobal("fetch",fetchMock);
  });

  afterEach(()=>{
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns disabled without calling Railway when configuration is missing",async()=>{
    await expect(triggerRailwayWorker("publish")).resolves.toEqual({status:"disabled"});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns already_running for the latest active deployment",async()=>{
    configure();
    fetchMock.mockResolvedValueOnce(jsonResponse(deploymentResponse(false)));

    await expect(triggerRailwayWorker("publish")).resolves.toEqual({status:"already_running",deploymentId:"deployment-1"});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(url).toBe("https://backboard.railway.com/graphql/v2");
    expect(init.headers).toEqual({"Content-Type":"application/json","Project-Access-Token":token});
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(String(init.body))).toMatchObject({variables:{input:{projectId:"project-id",environmentId:"environment-id",serviceId:"service-id"},first:1}});
  });

  it("restarts the latest stopped deployment",async()=>{
    configure();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(deploymentResponse(true)))
      .mockResolvedValueOnce(jsonResponse({data:{deploymentRestart:true}}));

    await expect(triggerRailwayWorker("publish")).resolves.toEqual({status:"restarted",deploymentId:"deployment-1"});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [,init]=fetchMock.mock.calls[1] as [string,RequestInit];
    const body=JSON.parse(String(init.body));
    expect(body.variables).toEqual({id:"deployment-1"});
    expect(body.query).toContain("deploymentRestart");
  });

  it("returns a safe failed result for GraphQL and network errors",async()=>{
    configure();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({errors:[{message:`token=${token}`}] }))
      .mockRejectedValueOnce(new Error(`request failed with ${token}`));

    const graphqlResult=await triggerRailwayWorker("publish");
    const networkResult=await triggerRailwayWorker("publish");
    expect(graphqlResult).toEqual({status:"failed",error:"Railway worker trigger failed"});
    expect(networkResult).toEqual({status:"failed",error:"Railway worker trigger failed"});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify([graphqlResult,networkResult])).not.toContain(token);
  });

  it("uses the service configured for the requested worker kind",async()=>{
    configure();
    vi.stubEnv("RAILWAY_HOOK_SERVICE_ID","hook-service");
    vi.stubEnv("RAILWAY_PUBLISH_SERVICE_ID","publish-service");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(deploymentResponse(false)))
      .mockResolvedValueOnce(jsonResponse(deploymentResponse(false)));

    await triggerRailwayWorker("hook");
    await triggerRailwayWorker("publish");

    const hookBody=JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const publishBody=JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(hookBody.variables.input.serviceId).toBe("hook-service");
    expect(publishBody.variables.input.serviceId).toBe("publish-service");
  });
});
