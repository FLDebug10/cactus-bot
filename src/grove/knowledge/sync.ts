// Keeps Grove's library in step with GitHub: the Handbook and the Apoli and
// Origins source. Each source is re-downloaded only when its branch moved, so
// a quiet day costs three tiny API calls.

import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import type { KnowledgeSource } from "../../config.ts";
import type { Logger } from "../../logger.ts";
import { type ChunkRecord, type FileRecord, prepare, stripRoot, wanted } from "./chunk.ts";
import type { KnowledgeStore } from "./store.ts";
import { readTar } from "./tar.ts";

export interface SyncResult {
  source: string;
  status: "updated" | "unchanged" | "failed";
  files?: number;
  chunks?: number;
  error?: string;
}

export interface SyncOptions {
  fetch?: typeof fetch;
  now?: () => number;
  log: Logger;
}

const HEADERS = { "User-Agent": "grove-discord-bot" };

export class KnowledgeSync {
  private readonly store: KnowledgeStore;
  private readonly sources: readonly KnowledgeSource[];
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly log: Logger;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<SyncResult[]> | null = null;

  constructor(store: KnowledgeStore, sources: readonly KnowledgeSource[], options: SyncOptions) {
    this.store = store;
    this.sources = sources;
    this.fetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    this.log = options.log;
  }

  // First sync shortly after startup, then every `hours`.
  start(hours: number): void {
    const run = (delay: number) => {
      this.timer = setTimeout(() => {
        void this.syncAll().finally(() => run(hours * 3_600_000));
      }, delay);
      this.timer.unref?.();
    };
    run(15_000);
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  syncAll(force = false): Promise<SyncResult[]> {
    if (this.running !== null) return this.running;
    this.running = (async () => {
      const results: SyncResult[] = [];
      for (const source of this.sources) results.push(await this.syncOne(source, force));
      return results;
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async syncOne(source: KnowledgeSource, force: boolean): Promise<SyncResult> {
    try {
      const sha = await this.headOf(source);
      const known = this.store.source(source.name);
      if (!force && known !== null && known.sha === sha) {
        this.store.touchSource(source.name, this.now());
        return { source: source.name, status: "unchanged" };
      }
      const { files, chunks } = await this.download(source, sha);
      if (files.length === 0) throw new Error("the archive had no files Grove reads");
      this.store.replaceSource(source.name, sha, files, chunks, this.now());
      this.log.info(`knowledge: ${source.name} @ ${sha.slice(0, 7)}, ${files.length} files, ${chunks.length} chunks`);
      return { source: source.name, status: "updated", files: files.length, chunks: chunks.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.warn(`knowledge: could not sync ${source.name}: ${message}`);
      return { source: source.name, status: "failed", error: message };
    }
  }

  private async headOf(source: KnowledgeSource): Promise<string> {
    const response = await this.fetch(`https://api.github.com/repos/${source.repo}/commits/${encodeURIComponent(source.branch)}`, {
      headers: { ...HEADERS, Accept: "application/vnd.github.sha" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${source.repo}@${source.branch}`);
    const sha = (await response.text()).trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`unexpected commit id from GitHub: ${sha.slice(0, 50)}`);
    return sha;
  }

  private async download(source: KnowledgeSource, sha: string): Promise<{ files: FileRecord[]; chunks: ChunkRecord[] }> {
    const response = await this.fetch(`https://codeload.github.com/${source.repo}/tar.gz/${sha}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok || response.body === null) throw new Error(`download failed with ${response.status}`);

    const files: FileRecord[] = [];
    const chunks: ChunkRecord[] = [];
    const archive = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>).pipe(createGunzip());
    for await (const entry of readTar(archive, (path, size) => wanted(source, stripRoot(path), size))) {
      const prepared = prepare(source, stripRoot(entry.path), entry.data.toString("utf8"));
      if (prepared === null) continue;
      files.push(prepared.file);
      chunks.push(...prepared.chunks);
    }
    return { files, chunks };
  }
}
