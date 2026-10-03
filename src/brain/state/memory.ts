// Long-term memory: what Grove remembers about each person between restarts.
// Kept deliberately small (a name to use, a few likes, how warm Grove feels
// toward them) so it stays friendly rather than creepy.

export interface Friend {
  userId: string;
  name: string;
  nickname: string | null;
  firstSeen: number;
  lastSeen: number;
  talks: number;
  // -1 (wary) .. 1 (best friends). Kindness raises it, meanness lowers it.
  affinity: number;
  likes: string[];
  lastTopic: string | null;
}

export interface Memory {
  friend(userId: string): Friend | null;
  save(friend: Friend): void;
  noteMiss(channelId: string, userId: string, text: string, at: number): void;
  recentMisses(limit: number): Array<{ at: number; userId: string; text: string }>;
  loadState(key: string): string | null;
  saveState(key: string, value: string): void;
}

export class InMemoryMemory implements Memory {
  private readonly friends = new Map<string, Friend>();
  private readonly misses: Array<{ at: number; userId: string; text: string }> = [];
  private readonly state = new Map<string, string>();

  friend(userId: string): Friend | null {
    const found = this.friends.get(userId);
    return found === undefined ? null : { ...found, likes: [...found.likes] };
  }

  save(friend: Friend): void {
    this.friends.set(friend.userId, { ...friend, likes: [...friend.likes] });
  }

  noteMiss(_channelId: string, userId: string, text: string, at: number): void {
    this.misses.push({ at, userId, text });
    if (this.misses.length > 200) this.misses.shift();
  }

  recentMisses(limit: number): Array<{ at: number; userId: string; text: string }> {
    return this.misses.slice(-limit).reverse();
  }

  loadState(key: string): string | null {
    return this.state.get(key) ?? null;
  }

  saveState(key: string, value: string): void {
    this.state.set(key, value);
  }
}

export function newFriend(userId: string, name: string, now: number): Friend {
  return { userId, name, nickname: null, firstSeen: now, lastSeen: now, talks: 0, affinity: 0, likes: [], lastTopic: null };
}
