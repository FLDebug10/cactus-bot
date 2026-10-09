import { BRAIN, CLOUD } from "../config.ts";
import type { Logger } from "../logger.ts";
import { Brain, BrainChain } from "./brain.ts";

// The brains from .env: the local one always, the cloud one when there is an
// API key, in the order GROVE_CLOUD_FIRST asks for.
export function brainsFromConfig(log: Logger): BrainChain {
  const local = new Brain({
    name: "local",
    url: BRAIN.url,
    model: BRAIN.model,
    contextTokens: BRAIN.contextTokens,
    keepAlive: BRAIN.keepAlive,
    think: BRAIN.think,
    timeoutMs: BRAIN.timeoutMs,
    draftTokens: BRAIN.draftTokens,
    log,
  });
  if (CLOUD.apiKey === null) return new BrainChain([local]);
  const cloud = new Brain({
    name: "cloud",
    url: CLOUD.url,
    model: CLOUD.model,
    contextTokens: CLOUD.contextTokens,
    keepAlive: null,
    think: BRAIN.think,
    timeoutMs: BRAIN.timeoutMs,
    headers: { Authorization: `Bearer ${CLOUD.apiKey}` },
    credits: true,
    log,
  });
  return new BrainChain(CLOUD.first ? [cloud, local] : [local, cloud]);
}
