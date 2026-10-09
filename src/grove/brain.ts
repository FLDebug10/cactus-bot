// Grove's chatting brains. Each `Brain` is one Ollama endpoint with one model:
// the local one on Overgrown's computer (free and unlimited, but only while the
// computer is on) and, optionally, a model on Ollama's cloud (always on, but
// with monthly credits). A `BrainChain` answers with the first brain that is
// usable right now, and when none is, Grove is a command bot until one is back.

import { Ollama, type Message, type Tool } from "ollama";
import type { Logger } from "../logger.ts";

export interface BrainOptions {
  // "cloud" or "local", for logs and !brain.
  name: string;
  url: string;
  model: string;
  contextTokens: number;
  keepAlive: string | null;
  think: boolean;
  timeoutMs: number;
  // Sent with every request, e.g. the cloud API key.
  headers?: Record<string, string>;
  // Ask ollama.com how many credits are left, and rest when they run out.
  credits?: boolean;
  // Speculative tokens for models with built-in multi-token prediction (the -mtp tags).
  draftTokens?: number | null;
  log: Logger;
  // Swapped out by tests.
  fetch?: typeof fetch;
  now?: () => number;
}

export interface BrainStatus {
  name: string;
  online: boolean;
  model: string;
  // When this state started, and when it was last confirmed.
  since: number;
  checkedAt: number;
  reason: string | null;
  capabilities: readonly string[];
  ollamaVersion: string | null;
  // Reachable, but not to be used before this time: out of credits or rate limited.
  restingUntil: number;
  restReason: string | null;
  // What ollama.com says is left, in words.
  credits: string | null;
}

export interface ToolBox {
  definitions: Tool[];
  run(name: string, args: Record<string, unknown>): Promise<string>;
}

export interface BrainRequest {
  system: string;
  messages: Message[];
  // Base64 images for the last message, used when the model can see.
  images?: readonly string[];
  tools?: ToolBox;
  maxToolRounds?: number;
  // Characters of tool results one reply may collect. Past it the model has to
  // answer with what it has, so the prompt never outgrows the context.
  toolBudget?: number;
  maxTokens?: number;
}

export interface BrainReply {
  text: string;
  brain: string;
  model: string;
  toolCalls: string[];
  promptTokens: number;
  replyTokens: number;
  ms: number;
}

// This brain can't answer right now (gone, out of credits, key refused): try the next one.
export class BrainUnavailable extends Error {}

const ONLINE_RECHECK_MS = 60_000;
const OFFLINE_RECHECK_MS = 20_000;
const CREDITS_RECHECK_MS = 5 * 60_000;
const PROBE_TIMEOUT_MS = 6_000;
const DEFAULT_REST_MS = 15 * 60_000;

function withTimeout(base: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return base(input, { ...init, signal });
  };
}

// Connection refused, DNS, reset, aborted: the brain isn't there. An HTTP error
// from a reachable Ollama is a different problem.
function unreachable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  const cause = (error as { cause?: { code?: string } }).cause;
  if (cause?.code !== undefined) return true;
  return /fetch failed|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENOTFOUND|socket hang up|other side closed/i.test(error.message);
}

function httpStatus(error: unknown): number | null {
  const status = (error as { status_code?: unknown } | null)?.status_code;
  return typeof status === "number" ? status : null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function timeOf(iso: string | undefined): number | null {
  if (iso === undefined) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? at : null;
}

interface Balance {
  included?: {
    balance_usd?: number;
    allowance_usd?: number;
    period?: { until?: string };
    session?: { remaining_percent?: number; resets_at?: string };
    weekly?: { remaining_percent?: number; resets_at?: string };
  };
  purchased?: { balance_usd?: number };
}

export class Brain {
  readonly name: string;
  private readonly options: BrainOptions;
  private readonly base: typeof fetch;
  private readonly probe: Ollama;
  private readonly client: Ollama;
  private readonly now: () => number;
  private state: BrainStatus;
  private thinkingValues: readonly unknown[] | null = null;
  private retryAfterMs: number | null = null;
  private creditsCheckedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private checking: Promise<BrainStatus> | null = null;
  private stopped = false;

  constructor(options: BrainOptions) {
    this.name = options.name;
    this.options = options;
    const raw = options.fetch ?? fetch;
    // Ollama's client doesn't pass response headers on, so keep Retry-After here.
    this.base = async (input, init) => {
      const response = await raw(input, init);
      if (response.status === 429) {
        const seconds = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        this.retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : null;
      }
      return response;
    };
    const headers = options.headers ?? {};
    this.probe = new Ollama({ host: options.url, headers, fetch: withTimeout(this.base, PROBE_TIMEOUT_MS) });
    this.client = new Ollama({ host: options.url, headers, fetch: withTimeout(this.base, options.timeoutMs) });
    this.now = options.now ?? Date.now;
    this.state = {
      name: options.name,
      online: false,
      model: options.model,
      since: this.now(),
      checkedAt: 0,
      reason: "not checked yet",
      capabilities: [],
      ollamaVersion: null,
      restingUntil: 0,
      restReason: null,
      credits: null,
    };
  }

  get status(): BrainStatus {
    return this.state;
  }

  // Reachable, has the model, and not resting.
  get usable(): boolean {
    return this.state.online && this.now() >= this.state.restingUntil;
  }

  can(capability: string): boolean {
    return this.state.capabilities.includes(capability);
  }

  start(): void {
    this.stopped = false;
    void this.check();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  // Asks Ollama whether it is there and has the model. Never throws.
  check(): Promise<BrainStatus> {
    if (this.checking !== null) return this.checking;
    this.checking = this.runCheck().finally(() => {
      this.checking = null;
      this.schedule();
    });
    return this.checking;
  }

  private schedule(): void {
    if (this.stopped) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.check(), this.state.online ? ONLINE_RECHECK_MS : OFFLINE_RECHECK_MS);
    this.timer.unref?.();
  }

  private async runCheck(): Promise<BrainStatus> {
    let version: string;
    try {
      version = (await this.probe.version()).version;
    } catch {
      return this.settle(false, `can't reach ${this.options.url}`, [], null);
    }
    let capabilities: string[];
    try {
      const shown = (await this.probe.show({ model: this.options.model })) as { capabilities?: unknown; thinking?: { values?: unknown } };
      capabilities = Array.isArray(shown.capabilities) ? shown.capabilities.filter((item): item is string => typeof item === "string") : ["completion"];
      this.thinkingValues = Array.isArray(shown.thinking?.values) ? shown.thinking.values : null;
    } catch (error) {
      const missing = httpStatus(error) === 404 || /not found|no such|pull/i.test(message(error));
      return this.settle(false, missing ? `the model ${this.options.model} isn't there (ollama pull ${this.options.model})` : `couldn't describe ${this.options.model}: ${message(error)}`, [], version);
    }
    if (this.options.credits === true && this.now() - this.creditsCheckedAt >= CREDITS_RECHECK_MS) {
      const refused = await this.checkCredits();
      if (refused !== null) return this.settle(false, refused, capabilities, version);
    }
    return this.settle(true, null, capabilities, version);
  }

  // Returns a reason when the key itself is refused; otherwise updates the credit state.
  private async checkCredits(): Promise<string | null> {
    let response: Response;
    try {
      response = await withTimeout(this.base, PROBE_TIMEOUT_MS)(`${this.options.url.replace(/\/+$/, "")}/api/balance`, { headers: this.options.headers ?? {} });
    } catch {
      return null;
    }
    if (response.status === 401 || response.status === 403) return "ollama.com refused the API key";
    if (!response.ok) return null;
    this.creditsCheckedAt = this.now();
    const balance = (await response.json().catch(() => ({}))) as Balance;
    const included = balance.included ?? {};
    const purchased = balance.purchased?.balance_usd ?? 0;
    if (typeof included.balance_usd === "number") {
      const left = included.balance_usd + purchased;
      this.state = { ...this.state, credits: `$${left.toFixed(2)} of credits left${typeof included.allowance_usd === "number" ? ` (of $${included.allowance_usd.toFixed(2)} a month)` : ""}` };
      if (left <= 0.001) this.rest(timeOf(included.period?.until) ?? this.now() + 60 * 60_000, "out of cloud credits until they refill");
      return null;
    }
    const session = included.session?.remaining_percent;
    const weekly = included.weekly?.remaining_percent;
    if (typeof session === "number" || typeof weekly === "number") {
      this.state = { ...this.state, credits: `${session ?? "?"}% of this session and ${weekly ?? "?"}% of this week left` };
      if (typeof weekly === "number" && weekly <= 0 && purchased <= 0) this.rest(timeOf(included.weekly?.resets_at) ?? this.now() + DEFAULT_REST_MS, "used up this week's cloud allowance");
      else if (typeof session === "number" && session <= 0 && purchased <= 0) this.rest(timeOf(included.session?.resets_at) ?? this.now() + DEFAULT_REST_MS, "used up this session's cloud allowance");
    }
    return null;
  }

  private rest(until: number, reason: string): void {
    if (until <= this.state.restingUntil && this.state.restReason === reason) return;
    this.state = { ...this.state, restingUntil: until, restReason: reason };
    this.options.log.warn(`${this.name} brain resting until ${new Date(until).toISOString()}: ${reason}`);
  }

  private settle(online: boolean, reason: string | null, capabilities: readonly string[], ollamaVersion: string | null): BrainStatus {
    const now = this.now();
    const changed = online !== this.state.online || reason !== this.state.reason;
    this.state = { ...this.state, online, since: changed ? now : this.state.since, checkedAt: now, reason, capabilities, ollamaVersion };
    if (changed) {
      if (online) this.options.log.info(`${this.name} brain online: ${this.options.model} (${capabilities.join(", ")})`);
      else this.options.log.warn(`${this.name} brain offline: ${reason ?? "unknown"}`);
    }
    return this.state;
  }

  // false when the model lets thinking be switched off, the lowest level when it
  // only has levels (glm-5.3-flash thinks at "max" unless told otherwise).
  private thinkParam(): boolean | "low" | undefined {
    if (!this.can("thinking")) return undefined;
    const values = this.thinkingValues;
    if (this.options.think) return values === null || values.includes(true) ? true : undefined;
    if (values === null || values.includes(false)) return false;
    return values.includes("low") ? "low" : undefined;
  }

  // One reply, letting the model call tools for a few rounds first.
  async reply(request: BrainRequest): Promise<BrainReply> {
    const started = this.now();
    const messages: Message[] = [{ role: "system", content: request.system }, ...request.messages];
    const last = messages[messages.length - 1];
    if (last !== undefined && request.images !== undefined && request.images.length > 0 && this.can("vision")) {
      messages[messages.length - 1] = { ...last, images: [...request.images] };
    }

    const useTools = request.tools !== undefined && this.can("tools");
    const maxRounds = useTools ? request.maxToolRounds ?? 3 : 0;
    const think = this.thinkParam();
    const toolCalls: string[] = [];
    const toolBudget = request.toolBudget ?? 7_000;
    let toolChars = 0;
    let promptTokens = 0;
    let replyTokens = 0;

    for (let round = 0; ; round++) {
      const offerTools = useTools && round < maxRounds && toolChars < toolBudget;
      let response;
      try {
        response = await this.client.chat({
          model: this.options.model,
          messages,
          stream: false,
          ...(offerTools ? { tools: request.tools!.definitions } : {}),
          ...(think !== undefined ? { think } : {}),
          ...(this.options.keepAlive !== null ? { keep_alive: this.options.keepAlive } : {}),
          options: {
            num_ctx: this.options.contextTokens,
            num_predict: request.maxTokens ?? 700,
            temperature: 0.7,
            top_p: 0.8,
            top_k: 20,
            ...(this.options.draftTokens !== undefined && this.options.draftTokens !== null ? { draft_num_predict: this.options.draftTokens } : {}),
          },
        });
      } catch (error) {
        throw this.failure(error);
      }

      promptTokens += response.prompt_eval_count ?? 0;
      replyTokens += response.eval_count ?? 0;
      const calls = response.message.tool_calls ?? [];
      if (!offerTools || calls.length === 0) {
        return { text: response.message.content ?? "", brain: this.name, model: this.options.model, toolCalls, promptTokens, replyTokens, ms: this.now() - started };
      }

      messages.push({ role: "assistant", content: response.message.content ?? "", tool_calls: calls });
      for (const call of calls.slice(0, 4)) {
        const name = call.function.name;
        toolCalls.push(name);
        let result: string;
        try {
          result = await request.tools!.run(name, call.function.arguments ?? {});
        } catch (error) {
          result = `the tool failed: ${message(error)}`;
        }
        const room = Math.max(300, toolBudget - toolChars);
        const clipped = result.length > room ? `${result.slice(0, room)}\n…(cut)` : result;
        toolChars += clipped.length;
        messages.push({ role: "tool", content: clipped, tool_name: name });
      }
    }
  }

  // Turns a failed request into a state change, and tells the chain whether to try the next brain.
  private failure(error: unknown): Error {
    if (unreachable(error)) {
      this.settle(false, `stopped answering mid-reply (${message(error)})`, [], this.state.ollamaVersion);
      this.schedule();
      return new BrainUnavailable(`${this.name} stopped answering`);
    }
    const status = httpStatus(error);
    if (status === 429) {
      this.rest(this.now() + (this.retryAfterMs ?? DEFAULT_REST_MS), `rate limited or out of credits (${message(error)})`);
      return new BrainUnavailable(`${this.name} is rate limited`);
    }
    if (status === 402) {
      this.rest(this.now() + 60 * 60_000, `out of credits (${message(error)})`);
      return new BrainUnavailable(`${this.name} is out of credits`);
    }
    if (status === 401 || status === 403) {
      this.settle(false, `refused: ${message(error)}`, [], this.state.ollamaVersion);
      return new BrainUnavailable(`${this.name} refused the request`);
    }
    if (status !== null && status >= 500) {
      this.rest(this.now() + 2 * 60_000, `server error ${status} (${message(error)})`);
      return new BrainUnavailable(`${this.name} had a server error`);
    }
    return error instanceof Error ? error : new Error(message(error));
  }
}

// The brains in the order Grove asks them.
export class BrainChain {
  readonly brains: readonly Brain[];

  constructor(brains: readonly Brain[]) {
    this.brains = brains;
  }

  get online(): boolean {
    return this.brains.some(brain => brain.usable);
  }

  // The brain the next reply would come from.
  get active(): Brain | null {
    return this.brains.find(brain => brain.usable) ?? null;
  }

  can(capability: string): boolean {
    return this.active?.can(capability) ?? false;
  }

  start(): void {
    for (const brain of this.brains) brain.start();
  }

  stop(): void {
    for (const brain of this.brains) brain.stop();
  }

  check(): Promise<BrainStatus[]> {
    return Promise.all(this.brains.map(brain => brain.check()));
  }

  // The first usable brain answers. If it fails because it went away or ran out
  // of credits, the next one gets the same request.
  async reply(request: BrainRequest): Promise<BrainReply> {
    let lastFailure: Error | null = null;
    for (const brain of this.brains) {
      if (!brain.usable) continue;
      try {
        return await brain.reply(request);
      } catch (error) {
        if (!(error instanceof BrainUnavailable)) throw error;
        lastFailure = error;
      }
    }
    throw lastFailure ?? new BrainUnavailable("no brain is awake");
  }
}
