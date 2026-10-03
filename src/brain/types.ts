// Shared shapes for Grove's brain. The brain never touches discord.js: the
// Discord adapter (src/features/chat.ts) turns messages into `ChatMessage`
// and turns `Decision`s back into replies and reactions. That keeps the whole
// brain runnable from tests and from `npm run chat`.

export interface ChatMessage {
  id: string;
  channelId: string;
  // The parent channel of a thread, or the forum of a forum post.
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorIsBot: boolean;
  content: string;
  createdAt: number;
  // The message this one replies to, and who wrote it, if any.
  replyToId: string | null;
  replyToAuthorId: string | null;
  // True when Grove itself was @mentioned (a reply ping does not count).
  mentionsGrove: boolean;
  // Users other than Grove that were @mentioned.
  mentionedUserIds: readonly string[];
  hasMedia: boolean;
}

export interface Clock {
  now(): number;
}

export type Random = () => number;

// A reaction-only answer, a reply, or both.
export interface Decision {
  replyToMessageId: string;
  text: string | null;
  reactions: readonly string[];
  // Images from assets/ to attach to the reply, by file name.
  files: readonly string[];
  // A !command whose output is sent instead of `text` ("help" for "what commands do you have?").
  command: string | null;
  delayMs: number;
  // When set, the adapter waits this long and asks `stillUnanswered` before
  // speaking, so Grove only helps when no person stepped in first.
  waitForSilenceMs: number;
  meta: DecisionMeta;
}

export interface DecisionMeta {
  // The messages this decision answers: the trigger plus any fragments merged into it.
  covers: readonly string[];
  act: string;
  // What the reply answered, so a follow-up ("what about tomorrow?") can ask it again about something else.
  intent: string;
  slots: Readonly<Record<string, string>>;
  // The question as Grove understood it, e.g. "what is your favorite food".
  question: string;
  topic: string | null;
  channelId: string;
  toUserId: string;
  toUserName: string;
  // What Grove meant, in plain words, for "what does that even mean?".
  gloss: string | null;
  // What Grove is waiting to hear back once this is sent. Null clears any earlier wait.
  expectation: Expectation | null;
}

// Something Grove asked and is waiting to hear back about.
export type Expectation =
  | { kind: "their_day" }
  | { kind: "their_feeling" }
  | { kind: "problem_source" }
  | { kind: "help_topic" }
  | { kind: "yes_no"; topic: string }
  | { kind: "name" }
  | { kind: "homework_subject" }
  | { kind: "dumb_answer" };
