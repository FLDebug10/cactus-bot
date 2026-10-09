import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { Brain, BrainChain, type BrainOptions, BrainUnavailable } from "../../src/grove/brain.ts";
import type { Logger } from "../../src/logger.ts";

const quiet: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

interface Scenario {
  models: Record<string, { capabilities: string[]; thinking?: { values: unknown[] } }>;
  chat: "tool-then-answer" | "answer" | "rate-limited";
  balance: unknown | null;
  answer: string;
}

interface Seen {
  tools: boolean;
  messages: Array<{ role: string; content: string }>;
  think?: unknown;
  options?: Record<string, unknown>;
  auth?: string;
}

// A pretend Ollama (or ollama.com), one per address, each with its own scenario.
async function fakeOllama(scenario: Scenario): Promise<{ url: string; seen: Seen[]; server: Server }> {
  const seen: Seen[] = [];
  const read = (request: IncomingMessage) => new Promise<Record<string, unknown>>(resolve => {
    let data = "";
    request.on("data", chunk => (data += chunk));
    request.on("end", () => resolve(data.length > 0 ? JSON.parse(data) as Record<string, unknown> : {}));
  });
  const json = (response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}) => {
    response.writeHead(status, { "Content-Type": "application/json", ...headers });
    response.end(JSON.stringify(value));
  };
  const server = createServer(async (request, response) => {
    const payload = await read(request);
    if (request.url === "/api/version") return json(response, 200, { version: "9.9.9" });
    if (request.url === "/api/show") {
      const model = scenario.models[String(payload["model"])];
      if (model === undefined) return json(response, 404, { error: `model '${String(payload["model"])}' not found` });
      return json(response, 200, { ...model, details: {}, model_info: {} });
    }
    if (request.url === "/api/balance") {
      if (scenario.balance === null) return json(response, 404, { error: "no" });
      return json(response, 200, scenario.balance);
    }
    if (request.url === "/api/chat") {
      const messages = payload["messages"] as Array<{ role: string; content: string }>;
      seen.push({ tools: Array.isArray(payload["tools"]), messages, think: payload["think"], options: payload["options"] as Record<string, unknown>, ...(request.headers.authorization !== undefined ? { auth: request.headers.authorization } : {}) });
      if (scenario.chat === "rate-limited") return json(response, 429, { error: "you've reached your usage limit" }, { "Retry-After": "120" });
      const usedTool = messages.some(message => message.role === "tool");
      const message = scenario.chat === "answer" || usedTool
        ? { role: "assistant", content: scenario.answer }
        : { role: "assistant", content: "", tool_calls: [{ function: { name: "search_handbook", arguments: { query: "resource" } } }] };
      return json(response, 200, { model: "x", created_at: new Date().toISOString(), message, done: true, prompt_eval_count: 100, eval_count: 5 });
    }
    json(response, 404, { error: "no" });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen, server };
}

const base = { contextTokens: 4096, keepAlive: null, think: false, timeoutMs: 5_000, log: quiet };
const brain = (options: Partial<BrainOptions> & { url: string; model: string; name?: string }) => new Brain({ ...base, name: "local", ...options });

let local: Awaited<ReturnType<typeof fakeOllama>>;
let cloud: Awaited<ReturnType<typeof fakeOllama>>;
const cloudScenario: Scenario = {
  models: { "glm-5.3-flash": { capabilities: ["completion", "tools", "thinking"], thinking: { values: ["low", "high", "max"] } } },
  chat: "answer",
  balance: null,
  answer: "hi from the cloud",
};

before(async () => {
  local = await fakeOllama({
    models: { "grove-test": { capabilities: ["completion", "tools", "thinking"], thinking: { values: [true, false] } } },
    chat: "tool-then-answer",
    balance: null,
    answer: "the max is 10!",
  });
  cloud = await fakeOllama(cloudScenario);
});

after(() => {
  local.server.close();
  cloud.server.close();
});

describe("brain", () => {
  it("comes online when ollama has the model, and uses a tool before answering", async () => {
    const grove = brain({ url: local.url, model: "grove-test", draftTokens: 3 });
    const status = await grove.check();
    grove.stop();
    assert.equal(status.online, true);
    assert.equal(grove.can("tools"), true);

    const ran: string[] = [];
    const reply = await grove.reply({
      system: "you are grove",
      messages: [{ role: "user", content: "sam: what's the max of a resource?" }],
      tools: { definitions: [], run: async (name, args) => (ran.push(`${name}:${String(args["query"])}`), "Resource (Power Type): max is required") },
    });
    grove.stop();
    assert.equal(reply.text, "the max is 10!");
    assert.equal(reply.brain, "local");
    assert.deepEqual(reply.toolCalls, ["search_handbook"]);
    assert.deepEqual(ran, ["search_handbook:resource"]);
    assert.equal(reply.promptTokens, 200);
    const last = local.seen[local.seen.length - 1]!;
    assert.equal(last.messages[0]?.role, "system");
    assert.equal(last.messages.some(message => message.role === "tool"), true);
    assert.equal(last.think, false);
    assert.equal(last.options?.["draft_num_predict"], 3);
  });

  it("tells the model to answer once its lookups are used up", async () => {
    const grove = brain({ url: local.url, model: "grove-test" });
    await grove.check();
    grove.stop();
    const reply = await grove.reply({
      system: "you are grove",
      messages: [{ role: "user", content: "sam: what's the max of a resource?" }],
      tools: { definitions: [], run: async () => "Resource (Power Type): max is required" },
      maxToolRounds: 1,
    });
    assert.equal(reply.text, "the max is 10!");
    const last = local.seen[local.seen.length - 1]!;
    assert.equal(last.tools, false);
    assert.equal(last.messages[last.messages.length - 1]?.role, "user");
    assert.match(last.messages[last.messages.length - 1]?.content ?? "", /can't look anything else up[^]*Don't say you'll check/);
  });

  it("stays offline when the model isn't pulled", async () => {
    const grove = brain({ url: local.url, model: "missing-model" });
    const status = await grove.check();
    grove.stop();
    assert.equal(status.online, false);
    assert.match(status.reason ?? "", /isn't there/);
  });

  it("is offline when nothing answers, and says so mid-reply", async () => {
    const closed = createServer();
    await new Promise<void>(resolve => closed.listen(0, "127.0.0.1", resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>(resolve => closed.close(() => resolve()));

    const grove = brain({ url: `http://127.0.0.1:${port}`, model: "grove-test" });
    const status = await grove.check();
    grove.stop();
    assert.equal(status.online, false);
    assert.match(status.reason ?? "", /can't reach/);
    await assert.rejects(grove.reply({ system: "s", messages: [{ role: "user", content: "hi" }] }), BrainUnavailable);
    grove.stop();
  });

  it("asks a model that can't switch thinking off for the lowest level, with the key", async () => {
    const grove = brain({ name: "cloud", url: cloud.url, model: "glm-5.3-flash", headers: { Authorization: "Bearer secret" } });
    await grove.check();
    grove.stop();
    const reply = await grove.reply({ system: "s", messages: [{ role: "user", content: "hi" }] });
    assert.equal(reply.text, "hi from the cloud");
    const last = cloud.seen[cloud.seen.length - 1]!;
    assert.equal(last.think, "low");
    assert.equal(last.auth, "Bearer secret");
  });
});

describe("brain chain", () => {
  it("falls back to the local brain when the cloud is rate limited, and rests the cloud", async () => {
    cloudScenario.chat = "rate-limited";
    const now = Date.now();
    const cloudBrain = brain({ name: "cloud", url: cloud.url, model: "glm-5.3-flash" });
    const localBrain = brain({ url: local.url, model: "grove-test" });
    const chain = new BrainChain([cloudBrain, localBrain]);
    await chain.check();
    chain.stop();
    assert.equal(chain.active?.name, "cloud");

    const reply = await chain.reply({ system: "s", messages: [{ role: "user", content: "hi" }] });
    chain.stop();
    assert.equal(reply.brain, "local");
    assert.equal(cloudBrain.usable, false);
    const restedFor = cloudBrain.status.restingUntil - now;
    assert.ok(restedFor >= 119_000 && restedFor <= 125_000, `rested for ${restedFor} ms`);
    assert.equal(chain.active?.name, "local");
    cloudScenario.chat = "answer";
  });

  it("rests the cloud until its credits refill", async () => {
    const refill = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString();
    cloudScenario.balance = { included: { balance_usd: 0, allowance_usd: 5, period: { until: refill } }, purchased: { balance_usd: 0 } };
    const cloudBrain = brain({ name: "cloud", url: cloud.url, model: "glm-5.3-flash", credits: true });
    const chain = new BrainChain([cloudBrain, brain({ url: local.url, model: "grove-test" })]);
    await chain.check();
    chain.stop();
    assert.equal(cloudBrain.status.online, true);
    assert.equal(cloudBrain.usable, false);
    assert.equal(cloudBrain.status.restingUntil, Date.parse(refill));
    assert.match(cloudBrain.status.credits ?? "", /\$0\.00 of credits left/);
    assert.equal(chain.active?.name, "local");
    cloudScenario.balance = null;
  });

  it("gives up only when every brain is down", async () => {
    const chain = new BrainChain([brain({ url: local.url, model: "missing-model" })]);
    await chain.check();
    chain.stop();
    assert.equal(chain.online, false);
    await assert.rejects(chain.reply({ system: "s", messages: [{ role: "user", content: "hi" }] }), BrainUnavailable);
  });
});
