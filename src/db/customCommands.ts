import type { Db } from "./database.ts";

export interface CustomCommand {
  cmd: string;
  help: string;
  out: string;
}

// Staff-registered text commands. Kept in memory for lookups on every message,
// written through to SQLite on change.
export class CustomCommandStore {
  private readonly byName = new Map<string, CustomCommand>();
  private readonly upsertStatement;
  private readonly deleteStatement;

  constructor(db: Db) {
    this.upsertStatement = db.prepare(
      "INSERT INTO commands (cmd, help, out) VALUES (?, ?, ?) ON CONFLICT(cmd) DO UPDATE SET help = excluded.help, out = excluded.out",
    );
    this.deleteStatement = db.prepare("DELETE FROM commands WHERE cmd = ?");

    const rows = db.prepare("SELECT cmd, help, out FROM commands").all() as CustomCommand[];
    for (const row of rows) this.byName.set(row.cmd, row);
  }

  get(name: string): CustomCommand | undefined {
    return this.byName.get(name);
  }

  all(): CustomCommand[] {
    return [...this.byName.values()].sort((a, b) => a.cmd.localeCompare(b.cmd));
  }

  save(command: CustomCommand): void {
    this.upsertStatement.run(command.cmd, command.help, command.out);
    this.byName.set(command.cmd, command);
  }

  remove(name: string): boolean {
    const removed = this.deleteStatement.run(name).changes > 0;
    this.byName.delete(name);
    return removed;
  }
}
