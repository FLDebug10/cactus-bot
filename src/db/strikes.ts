import type { Db } from "./database.ts";

// Times someone asked Grove something it won't talk about. Kept in SQLite so a
// restart doesn't wipe the slate, and trimmed to the last 30 days.
export class StrikeStore {
  private readonly insertStatement;
  private readonly countStatement;
  private readonly trimStatement;

  constructor(db: Db) {
    this.insertStatement = db.prepare("INSERT INTO grove_strikes (user_id, at, kind, text) VALUES (?, ?, ?, ?)");
    this.countStatement = db.prepare("SELECT COUNT(*) AS n FROM grove_strikes WHERE user_id = ? AND kind = ? AND at > ?");
    this.trimStatement = db.prepare("DELETE FROM grove_strikes WHERE at < ?");
  }

  // Records a strike and returns how many this person has inside the window, this one included.
  add(userId: string, at: number, kind: string, text: string, windowMs: number): number {
    this.trimStatement.run(at - 30 * 24 * 60 * 60_000);
    this.insertStatement.run(userId, at, kind, text.slice(0, 500));
    return (this.countStatement.get(userId, kind, at - windowMs) as { n: number }).n;
  }
}
