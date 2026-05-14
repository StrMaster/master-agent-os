import { Redis } from "@upstash/redis";

const PIPELINE_KEY = "master-agent-os:pipelines";

export type PipelineStage =
  | "research"
  | "competitor"
  | "pricing"
  | "build"
  | "listing"
  | "outreach";

export type PipelineStageStatus =
  | "pending"
  | "running"
  | "waiting-approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export type PipelineStageData = {
  stage: PipelineStage;
  status: PipelineStageStatus;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

export type Pipeline = {
  id: string;
  name: string;
  niche: string;
  productType: string;
  targetMarket: string;
  status: "active" | "completed" | "cancelled";
  stages: PipelineStageData[];
  createdAt: string;
  updatedAt: string;
};

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Redis env vars");
  return new Redis({ url, token });
}

export async function createPipeline(input: {
  name: string;
  niche: string;
  productType: string;
  targetMarket: string;
}): Promise<Pipeline> {
  const pipeline: Pipeline = {
    id: `pipeline-${Date.now()}`,
    name: input.name,
    niche: input.niche,
    productType: input.productType,
    targetMarket: input.targetMarket,
    status: "active",
    stages: [
      { stage: "research", status: "pending" },
      { stage: "competitor", status: "pending" },
      { stage: "pricing", status: "pending" },
      { stage: "build", status: "pending" },
      { stage: "listing", status: "pending" },
      { stage: "outreach", status: "pending" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const redis = getRedis();
  const existing = await redis.get<Pipeline[]>(PIPELINE_KEY) ?? [];
  await redis.set(PIPELINE_KEY, [pipeline, ...existing].slice(0, 20));

  return pipeline;
}

export async function getPipelines(): Promise<Pipeline[]> {
  const redis = getRedis();
  return await redis.get<Pipeline[]>(PIPELINE_KEY) ?? [];
}

export async function updatePipelineStage(
  pipelineId: string,
  stage: PipelineStage,
  update: Partial<PipelineStageData>
): Promise<Pipeline | null> {
  const redis = getRedis();
  const pipelines = await redis.get<Pipeline[]>(PIPELINE_KEY) ?? [];
  const idx = pipelines.findIndex((p) => p.id === pipelineId);
  if (idx === -1) return null;

  const pipeline = pipelines[idx];
  const stageIdx = pipeline.stages.findIndex((s) => s.stage === stage);
  if (stageIdx === -1) return null;

  pipeline.stages[stageIdx] = { ...pipeline.stages[stageIdx], ...update };
  pipeline.updatedAt = new Date().toISOString();
  pipelines[idx] = pipeline;

  await redis.set(PIPELINE_KEY, pipelines);
  return pipeline;
}

export async function deletePipeline(pipelineId: string): Promise<void> {
  const redis = getRedis();
  const pipelines = await redis.get<Pipeline[]>(PIPELINE_KEY) ?? [];
  await redis.set(PIPELINE_KEY, pipelines.filter((p) => p.id !== pipelineId));
}
