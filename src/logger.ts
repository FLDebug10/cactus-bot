import { SETTINGS } from "./config.ts";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const threshold = LEVELS[(SETTINGS.logLevel as Level)] ?? LEVELS.info;

function write(level: Level, scope: string, message: string, extra: unknown[]): void {
  if (LEVELS[level] < threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (extra.length > 0) sink(line, ...extra);
  else sink(line);
}

export interface Logger {
  debug(message: string, ...extra: unknown[]): void;
  info(message: string, ...extra: unknown[]): void;
  warn(message: string, ...extra: unknown[]): void;
  error(message: string, ...extra: unknown[]): void;
}

export function logger(scope: string): Logger {
  return {
    debug: (message, ...extra) => write("debug", scope, message, extra),
    info: (message, ...extra) => write("info", scope, message, extra),
    warn: (message, ...extra) => write("warn", scope, message, extra),
    error: (message, ...extra) => write("error", scope, message, extra),
  };
}
