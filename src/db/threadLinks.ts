import type { Db } from "./database.ts";

// Who claimed which suggestion post. Thread id -> user id.
export class SuggestionClaims {
  private readonly claims = new Map<string, string>();
  private readonly insertStatement;
  private readonly deleteStatement;

  constructor(db: Db) {
    this.insertStatement = db.prepare("INSERT OR REPLACE INTO suggestions (thread, user) VALUES (?, ?)");
    this.deleteStatement = db.prepare("DELETE FROM suggestions WHERE thread = ?");

    const rows = db.prepare("SELECT thread, user FROM suggestions").all() as Array<{ thread: string; user: string }>;
    for (const row of rows) this.claims.set(row.thread, row.user);
  }

  claimant(threadId: string): string | undefined {
    return this.claims.get(threadId);
  }

  claim(threadId: string, userId: string): void {
    this.insertStatement.run(threadId, userId);
    this.claims.set(threadId, userId);
  }

  release(threadId: string): void {
    this.deleteStatement.run(threadId);
    this.claims.delete(threadId);
  }
}

// Open modmail conversations, looked up from both ends: the user who DMed
// Grove, and the forum thread staff reply in.
export class ModmailLinks {
  private readonly threadByUser = new Map<string, string>();
  private readonly userByThread = new Map<string, string>();
  private readonly insertStatement;
  private readonly deleteStatement;

  constructor(db: Db) {
    this.insertStatement = db.prepare("INSERT OR REPLACE INTO modMail (user, thread) VALUES (?, ?)");
    this.deleteStatement = db.prepare("DELETE FROM modMail WHERE user = ?");

    const rows = db.prepare("SELECT user, thread FROM modMail").all() as Array<{ user: string; thread: string }>;
    for (const row of rows) this.link(row.user, row.thread);
  }

  threadOf(userId: string): string | undefined {
    return this.threadByUser.get(userId);
  }

  userOf(threadId: string): string | undefined {
    return this.userByThread.get(threadId);
  }

  open(userId: string, threadId: string): void {
    const previous = this.threadByUser.get(userId);
    if (previous !== undefined) this.userByThread.delete(previous);
    this.insertStatement.run(userId, threadId);
    this.link(userId, threadId);
  }

  close(userId: string): void {
    const threadId = this.threadByUser.get(userId);
    this.deleteStatement.run(userId);
    this.threadByUser.delete(userId);
    if (threadId !== undefined) this.userByThread.delete(threadId);
  }

  private link(userId: string, threadId: string): void {
    this.threadByUser.set(userId, threadId);
    this.userByThread.set(threadId, userId);
  }
}
