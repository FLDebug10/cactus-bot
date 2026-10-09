// A small streaming reader for the .tar.gz archives GitHub serves. Only the
// files the caller asks for are kept in memory, everything else (textures,
// fonts, sprite sheets) streams past, so the 1 GiB VM never holds a whole
// repository at once.

export interface TarEntry {
  path: string;
  size: number;
  data: Buffer;
}

export type TarFilter = (path: string, size: number) => boolean;

const BLOCK = 512;
const TYPE_FILE = 0x30;
const TYPE_FILE_OLD = 0;
const TYPE_PAX = 0x78;
const TYPE_GNU_LONG_NAME = 0x4c;

class ByteQueue {
  private readonly chunks: Buffer[] = [];
  private bytes = 0;

  get size(): number {
    return this.bytes;
  }

  push(chunk: Buffer): void {
    if (chunk.length === 0) return;
    this.chunks.push(chunk);
    this.bytes += chunk.length;
  }

  take(count: number): Buffer {
    const out = Buffer.allocUnsafe(count);
    let written = 0;
    while (written < count) {
      const head = this.chunks[0]!;
      const used = Math.min(head.length, count - written);
      head.copy(out, written, 0, used);
      written += used;
      this.dropFront(used);
    }
    return out;
  }

  drop(count: number): number {
    let dropped = 0;
    while (dropped < count && this.chunks.length > 0) {
      const head = this.chunks[0]!;
      const used = Math.min(head.length, count - dropped);
      this.dropFront(used);
      dropped += used;
    }
    return dropped;
  }

  private dropFront(count: number): void {
    const head = this.chunks[0]!;
    if (count >= head.length) this.chunks.shift();
    else this.chunks[0] = head.subarray(count);
    this.bytes -= count;
  }
}

function text(block: Buffer, start: number, length: number): string {
  const end = block.indexOf(0, start);
  return block.toString("utf8", start, end === -1 || end > start + length ? start + length : end);
}

function octal(block: Buffer, start: number, length: number): number {
  const raw = text(block, start, length).trim();
  return raw.length === 0 ? 0 : Number.parseInt(raw, 8);
}

// "27 path=some/long/name\n" records; only the path matters here.
function paxPath(data: Buffer): string | null {
  const records = data.toString("utf8");
  let offset = 0;
  while (offset < records.length) {
    const space = records.indexOf(" ", offset);
    if (space === -1) break;
    const length = Number.parseInt(records.slice(offset, space), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = records.slice(space + 1, offset + length - 1);
    if (record.startsWith("path=")) return record.slice(5);
    offset += length;
  }
  return null;
}

export async function* readTar(stream: AsyncIterable<Buffer>, want: TarFilter): AsyncGenerator<TarEntry> {
  const iterator = stream[Symbol.asyncIterator]();
  const queue = new ByteQueue();
  let finished = false;

  async function fill(count: number): Promise<boolean> {
    while (queue.size < count && !finished) {
      const next = await iterator.next();
      if (next.done === true) finished = true;
      else queue.push(next.value);
    }
    return queue.size >= count;
  }

  async function skip(count: number): Promise<boolean> {
    let left = count;
    while (left > 0) {
      if (queue.size === 0 && !(await fill(1))) return false;
      left -= queue.drop(left);
    }
    return true;
  }

  let nextPath: string | null = null;
  while (await fill(BLOCK)) {
    const header = queue.take(BLOCK);
    if (header.every(byte => byte === 0)) return;

    const size = octal(header, 124, 12);
    const type = header[156] ?? TYPE_FILE_OLD;
    let path = text(header, 0, 100);
    if (header.toString("ascii", 257, 262) === "ustar") {
      const prefix = text(header, 345, 155);
      if (prefix.length > 0) path = `${prefix}/${path}`;
    }
    if (nextPath !== null) {
      path = nextPath;
      nextPath = null;
    }

    const padded = Math.ceil(size / BLOCK) * BLOCK;
    const meta = type === TYPE_PAX || type === TYPE_GNU_LONG_NAME;
    const file = type === TYPE_FILE || type === TYPE_FILE_OLD;
    if (meta || (file && want(path, size))) {
      if (!(await fill(padded))) return;
      const body = queue.take(padded).subarray(0, size);
      if (type === TYPE_PAX) nextPath = paxPath(body);
      else if (type === TYPE_GNU_LONG_NAME) nextPath = text(body, 0, body.length);
      else yield { path, size, data: body };
    } else if (!(await skip(padded))) {
      return;
    }
  }
}
