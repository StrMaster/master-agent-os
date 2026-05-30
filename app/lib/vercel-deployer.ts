const VERCEL_API = "https://api.vercel.com";

function getToken() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("Missing VERCEL_TOKEN");
  return token;
}

export type VercelProject = {
  id: string;
  name: string;
  url: string;
};

export type VercelDeployment = {
  id: string;
  url: string;
  state: string;
  readyState: string;
};

export async function createVercelProject(input: {
  name: string;
  githubOwner: string;
  githubRepo: string;
}): Promise<VercelProject> {
  const token = getToken();

  const res = await fetch(`${VERCEL_API}/v9/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      framework: "nextjs",
      gitRepository: {
        type: "github",
        repo: `${input.githubOwner}/${input.githubRepo}`,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create Vercel project: ${res.status} ${text}`);
  }

  const data = await res.json();

  return {
    id: data.id,
    name: data.name,
    url: `https://${data.name}.vercel.app`,
  };
}

export async function triggerVercelDeploy(input: {
  projectId: string;
  githubOwner: string;
  githubRepo: string;
}): Promise<VercelDeployment> {
  const token = getToken();

  const res = await fetch(`${VERCEL_API}/v13/deployments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.projectId,
      gitSource: {
        type: "github",
        repo: `${input.githubOwner}/${input.githubRepo}`,
        ref: "main",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to trigger deployment: ${res.status} ${text}`);
  }

  const data = await res.json();

  return {
    id: data.id,
    url: `https://${data.url}`,
    state: data.state,
    readyState: data.readyState,
  };
}

export async function getDeploymentStatus(deploymentId: string): Promise<VercelDeployment> {
  const token = getToken();

  const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get deployment status: ${res.status} ${text}`);
  }

  const data = await res.json();

  return {
    id: data.id,
    url: `https://${data.url}`,
    state: data.state,
    readyState: data.readyState,
  };
}
