import "server-only";

const RAILWAY_GRAPHQL_URL = "https://backboard.railway.com/graphql/v2";
const DEPLOYMENTS_QUERY = `
  query LatestDeployments($input: DeploymentListInput!, $first: Int!) {
    deployments(input: $input, first: $first) {
      edges {
        node {
          id
          status
          deploymentStopped
        }
      }
    }
  }
`;
const RESTART_MUTATION = `
  mutation RestartDeployment($id: String!) {
    deploymentRestart(id: $id)
  }
`;
const SAFE_FAILURE = "Railway worker trigger failed";

type RailwayConfig = {
  token: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

export type RailwayWorkerKind = "hook" | "publish";

type GraphQLResponse<T> = {
  data?: T;
  errors?: unknown[];
};

type Deployment = {
  id: string;
  status: string;
  deploymentStopped: boolean;
};

type DeploymentQueryData = {
  deployments?: {
    edges?: Array<{ node?: Deployment | null }>;
  };
};

type RestartMutationData = {
  deploymentRestart?: boolean;
};

export type RailwayWorkerTriggerResult =
  | { status: "disabled" }
  | { status: "already_running"; deploymentId: string }
  | { status: "restarted"; deploymentId: string }
  | { status: "failed"; error: string };

function getConfig(kind: RailwayWorkerKind): RailwayConfig | null {
  const kindServiceId = kind === "hook"
    ? process.env.RAILWAY_HOOK_SERVICE_ID?.trim()
    : process.env.RAILWAY_PUBLISH_SERVICE_ID?.trim();
  const values = {
    token: process.env.RAILWAY_TRIGGER_TOKEN?.trim(),
    projectId: process.env.RAILWAY_PROJECT_ID?.trim(),
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID?.trim(),
    serviceId: kindServiceId || process.env.RAILWAY_SERVICE_ID?.trim(),
  };
  return values.token && values.projectId && values.environmentId && values.serviceId
    ? values as RailwayConfig
    : null;
}

async function request<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(RAILWAY_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Project-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const payload = await response.json() as GraphQLResponse<T>;
  if (!response.ok || payload.errors?.length || !payload.data) throw new Error(SAFE_FAILURE);
  return payload.data;
}

export async function triggerRailwayWorker(kind: RailwayWorkerKind): Promise<RailwayWorkerTriggerResult> {
  const config = getConfig(kind);
  if (!config) return { status: "disabled" };

  try {
    const queryData = await request<DeploymentQueryData>(config.token, DEPLOYMENTS_QUERY, {
      input: {
        projectId: config.projectId,
        environmentId: config.environmentId,
        serviceId: config.serviceId,
      },
      first: 1,
    });
    const deployment = queryData.deployments?.edges?.[0]?.node;
    if (!deployment || !deployment.id || typeof deployment.deploymentStopped !== "boolean") {
      return { status: "failed", error: "No valid deployment found" };
    }
    if (!deployment.deploymentStopped) {
      return { status: "already_running", deploymentId: deployment.id };
    }

    const restartData = await request<RestartMutationData>(config.token, RESTART_MUTATION, { id: deployment.id });
    if (restartData.deploymentRestart !== true) return { status: "failed", error: SAFE_FAILURE };
    return { status: "restarted", deploymentId: deployment.id };
  } catch {
    return { status: "failed", error: SAFE_FAILURE };
  }
}
