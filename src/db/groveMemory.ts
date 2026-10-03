import type { Friend, Memory } from "../brain/state/memory.ts";
import type { Db } from "./database.ts";

interface FriendRow {
  user_id: string;
  name: string;
  nickname: string | null;
  first_seen: number;
  last_seen: number;
  talks: number;
  affinity: number;
  likes: string;
  last_topic: string | null;
}

const MAX_MISSES = 500;

// Grove's long-term memory, kept in SQLite so it survives restarts.
export class SqliteMemory implements Memory {
  private readonly getFriend;
  private readonly putFriend;
  private readonly topFriends;
  private readonly addMiss;
  private readonly trimMisses;
  private readonly listMisses;
  private readonly getState;
  private readonly putState;

  constructor(db: Db) {
    this.getFriend = db.prepare("SELECT * FROM grove_users WHERE user_id = ?");
    this.putFriend = db.prepare(`
      INSERT INTO grove_users (user_id, name, nickname, first_seen, last_seen, talks, affinity, likes, last_topic)
      VALUES (@user_id, @name, @nickname, @first_seen, @last_seen, @talks, @affinity, @likes, @last_topic)
      ON CONFLICT(user_id) DO UPDATE SET
        name = excluded.name, nickname = excluded.nickname, last_seen = excluded.last_seen, talks = excluded.talks,
        affinity = excluded.affinity, likes = excluded.likes, last_topic = excluded.last_topic
    `);
    this.topFriends = db.prepare("SELECT * FROM grove_users ORDER BY affinity DESC, talks DESC LIMIT ?");
    this.addMiss = db.prepare("INSERT INTO grove_misses (at, channel_id, user_id, text) VALUES (?, ?, ?, ?)");
    this.trimMisses = db.prepare(`DELETE FROM grove_misses WHERE id <= (SELECT id FROM grove_misses ORDER BY id DESC LIMIT 1 OFFSET ${MAX_MISSES})`);
    this.listMisses = db.prepare("SELECT at, user_id, text FROM grove_misses ORDER BY id DESC LIMIT ?");
    this.getState = db.prepare("SELECT value FROM grove_state WHERE key = ?");
    this.putState = db.prepare("INSERT INTO grove_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  }

  friend(userId: string): Friend | null {
    const row = this.getFriend.get(userId) as FriendRow | undefined;
    return row === undefined ? null : toFriend(row);
  }

  favorites(limit: number): Friend[] {
    return (this.topFriends.all(limit) as FriendRow[]).map(toFriend);
  }

  save(friend: Friend): void {
    this.putFriend.run({
      user_id: friend.userId,
      name: friend.name,
      nickname: friend.nickname,
      first_seen: friend.firstSeen,
      last_seen: friend.lastSeen,
      talks: friend.talks,
      affinity: friend.affinity,
      likes: JSON.stringify(friend.likes.slice(0, 20)),
      last_topic: friend.lastTopic,
    });
  }

  noteMiss(channelId: string, userId: string, text: string, at: number): void {
    this.addMiss.run(at, channelId, userId, text);
    this.trimMisses.run();
  }

  recentMisses(limit: number): Array<{ at: number; userId: string; text: string }> {
    const rows = this.listMisses.all(limit) as Array<{ at: number; user_id: string; text: string }>;
    return rows.map(row => ({ at: row.at, userId: row.user_id, text: row.text }));
  }

  loadState(key: string): string | null {
    const row = this.getState.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  saveState(key: string, value: string): void {
    this.putState.run(key, value);
  }
}

function toFriend(row: FriendRow): Friend {
  let likes: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.likes);
    if (Array.isArray(parsed)) likes = parsed.filter((like): like is string => typeof like === "string");
  } catch {
    likes = [];
  }
  return {
    userId: row.user_id,
    name: row.name,
    nickname: row.nickname,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    talks: row.talks,
    affinity: row.affinity,
    likes,
    lastTopic: row.last_topic,
  };
}
