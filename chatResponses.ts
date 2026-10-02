// The word bank behind Grove's brain.
//
// `chat.ts` decides *when* Grove answers; this file decides *what* it says.
// Each intent owns a pool of replies, one is picked at random (never the same
// one twice in a row) and lightly personalised with whatever context was
// gathered from the channel, the message being replied to, the recent
// conversation, and the commands the bot actually has registered.
//
// Nothing here touches the Discord API, so the whole thing stays readable and tunable.

export type Intent =
  | "greeting"
  | "howAreYou"
  | "identity"
  | "thanks"
  | "farewell"
  | "laugh"
  | "compliment"
  | "apology"
  | "thinking"
  | "repeat"
  | "affirm"
  | "deny"
  | "uncertain"
  | "helpRequest"
  | "topic"
  | "question"
  | "statement"
  | "fallback"
  | "smalltalk";

export type Topic =
  | "bug"
  | "datapack"
  | "resourcepack"
  | "json"
  | "media"
  | "handbook"
  | "contest";

export interface CommandHint {
  cmd: string;
  help: string;
}

export interface RecentMessage {
  id: string;
  author: string;
  authorId: string;
  content: string;
  bot: boolean;
  /** snowflake-derived timestamp, used for ordering */
  createdTimestamp: number;
}

export interface ResponseContext {
  /** lowercased, mention-stripped version of the message */
  text: string;
  /** word-level tokens of `text`, used for keyword matching */
  tokens: Set<string>;
  /** original message content, used for quoting */
  raw: string;
  /** display name of whoever asked */
  author: string;
  /** content of the message being replied to, if any */
  referenced: string | null;
  /** topics other people have been talking about in this channel */
  historyTopics: Topic[];
  /** the previous reply Grove gave this user, for "say that again" */
  lastReply: string | null;
  /** what Grove was talking about last turn, so "yeah" means something */
  lastTopic: Topic | null;
  /** true when the user asked the exact same thing twice in a row */
  repeatedQuestion: boolean;
  /** every command Grove knows about, including staff-registered ones */
  commands: CommandHint[];
}


// --- text helpers -------------------------------------------------------

const MENTION_PATTERN = /<@!?\d+>/g;
const ROLE_PATTERN = /<@&\d+>/g;
const CHANNEL_PATTERN = /<#\d+>/g;
const CUSTOM_EMOJI_PATTERN = /<a?:\w+:\d+>/g;
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const URL_PATTERN = /https?:\S+/g;
const SPLIT_PATTERN = /[\s!?.,;:"()[\]{}<>/\\|@#$%^&*+=~`]+/;

/** Strips discord syntax so keywords aren't hidden behind mention syntax. */
export function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(MENTION_PATTERN, " ")
    .replace(ROLE_PATTERN, " ")
    .replace(CHANNEL_PATTERN, " ")
    .replace(CUSTOM_EMOJI_PATTERN, " ")
    .replace(CODE_BLOCK_PATTERN, " ")
    .replace(URL_PATTERN, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();

  for (const raw of text.split(SPLIT_PATTERN)) {
    const token = raw.replace(/^'+|'+$/g, "");

    if (token.length > 0) tokens.add(token);
  }

  return tokens;
}

function hasWords(tokens: Set<string>, words: string[]): boolean {
  for (const word of words) {
    if (tokens.has(word)) return true;
  }

  return false;
}

function hasPhrases(text: string, phrases: string[]): boolean {
  for (const phrase of phrases) {
    if (text.includes(phrase)) return true;
  }

  return false;
}

function isQuestion(text: string, tokens: Set<string>): boolean {
  // note: `?` is a split character, so it never survives into the tokens
  if (text.includes("?")) return true;

  const openings = [
    "who", "what", "when", "where", "which", "whose",
    "how", "is", "are", "was", "were", "do", "does", "did",
    "can", "could", "should", "would", "will", "am",
  ];

  return openings.some(word => tokens.has(word));
}


// --- keyword rules ------------------------------------------------------

interface IntentRule {
  intent: Intent;
  /** whole words that trigger the intent */
  words?: string[];
  /** multi word phrases that trigger the intent */
  phrases?: string[];
  /** higher wins when several intents match at once */
  weight?: number;
}

export const RULES: IntentRule[] = [
  {
    intent: "howAreYou",
    weight: 4,
    words: ["sup", "sups", "wassup", "whatsup"],
    phrases: [
      "how are you", "how're you", "how r u", "how r you", "how u",
      "hows it going", "how's it going", "hows everything", "hows everything",
      "how has your", "how was your", "how been", "you doing", "you good",
      "you alright", "you okay", "how are things", "whats up", "what's up",
      "how goes it", "you survive", "how you doing",
    ],
  },
  {
    intent: "identity",
    weight: 5,
    words: ["llm", "ai", "human", "real", "alive"],
    phrases: [
      "who are you", "who r u", "what are you", "what r u", "are you a bot",
      "are you real", "are you human", "are you ai", "are you an ai",
      "is this a bot", "what can you do", "what do you do",
      "what are you for", "what do you know", "tell me about yourself",
      "are you grove", "whats grove", "whats this bot",
    ],
  },
  {
    intent: "helpRequest",
    weight: 4,
    words: ["help", "helping", "assistance", "aid", "stuck", "lost", "confused", "confusing", "advice", "tips", "hint", "hints", "guide"],
    phrases: [
      "can you help", "could you help", "would you help", "can i ask",
      "can i get", "how do i", "how do you", "how can i", "how would i",
      "how should i", "what should i", "where do i", "what do i do",
      "i need help", "need help", "help me", "any idea", "any ideas",
      "any advice", "any tips", "give me a hand", "lend a hand",
    ],
  },
  {
    intent: "repeat",
    weight: 6,
    words: ["again", "repeat"],
    phrases: [
      "say that again", "say it again", "come again", "what did you say",
      "repeat that", "didnt hear", "didn't hear", "what was that",
      "scroll up", "run that again",
    ],
  },
  {
    intent: "thanks",
    weight: 3,
    words: ["thanks", "thankyou", "thx", "ty", "appreciate", "appreciated", "cheers", "grateful", "helpful"],
    phrases: ["thank you", "thanks a lot", "thanks so much", "thank u", "appreciate it", "appreciate you"],
  },
  {
    intent: "farewell",
    weight: 3,
    words: ["bye", "goodbye", "later", "night", "nighty", "gtg", "cya", "adios", "laterz"],
    phrases: [
      "good night", "good morning to you", "see ya", "see you", "see you later",
      "talk later", "gotta go", "have to go", "im off", "i'm off",
      "signing off", "catch you later", "bye bye",
    ],
  },
  {
    intent: "greeting",
    weight: 2,
    words: ["hi", "hello", "hey", "heya", "hiya", "yo", "howdy", "greetings", "morning", "afternoon", "evening", "gm", "gn", "ohai", "salut"],
    phrases: ["hello there", "hey there", "hi there", "good morning", "good afternoon", "good evening", "howdy partner", "heyy"],
  },
  {
    intent: "laugh",
    weight: 3,
    words: ["lol", "lmao", "rofl", "haha", "xd", "lmaooo", "hilarious"],
    phrases: ["😂", "🤣", "😭", "💀", "this is funny", "so funny", "im dying", "i'm dying", "kill me", "sent me"],
  },
  {
    intent: "compliment",
    weight: 2,
    words: ["nice", "cool", "great", "awesome", "amazing", "beautiful", "love", "lovely", "neat", "clean", "sick", "insane", "fire", "impressive", "clever", "elegant"],
    phrases: ["looks good", "looks great", "nice work", "good job", "you rock", "love it", "well done", "sounds fun", "thats neat", "that's neat"],
  },
  {
    intent: "apology",
    weight: 4,
    words: ["sorry", "apologise", "apologize", "oops", "misread", "meant"],
    phrases: ["my bad", "my apologies", "sorry about that", "didnt mean", "didn't mean", "my mistake", "excuse me", "pardon"],
  },
  {
    intent: "thinking",
    weight: 3,
    words: ["hmm", "huh", "wait", "think", "thinking", "hm", "er", "um"],
    phrases: ["let me", "give me a sec", "one sec", "one moment", "hang on", "wait a min", "brb", "be right back"],
  },
  {
    intent: "deny",
    weight: 3,
    words: ["no", "nope", "nah", "negative", "wrong", "incorrect", "disagree", "disagreed", "unfortunately"],
    phrases: [
      "not really", "i dont think so", "i don't think so", "no thanks",
      "not right", "thats wrong", "that's wrong", "dont think so",
      "don't think so", "i disagree", "doesnt work", "doesn't work",
    ],
  },
  {
    intent: "uncertain",
    weight: 3,
    words: ["idk", "dunno", "unknown", "maybe", "possibly", "unsure", "unclear", "guess"],
    phrases: [
      "i dont know", "i don't know", "no idea", "not sure", "who knows",
      "hard to say", "cant tell", "can't tell", "no clue", "im not sure",
      "i'm not sure", "sort of", "kinda",
    ],
  },
  {
    intent: "affirm",
    weight: 2,
    words: ["yes", "yeah", "yep", "yup", "sure", "okay", "ok", "kk", "alright", "agreed", "agree", "indeed", "true", "correct", "exactly", "absolutely", "definitely", "same", "bet", "soundsgood", "fine", "done", "gotcha", "understand", "makes"],
    phrases: [
      "sounds good", "sounds fun", "will do", "makes sense", "fair enough",
      "that works", "good idea", "for sure", "of course", "right on",
      "i guess so", "thats fair", "that's fair", "yeah sure", "ok cool",
    ],
  },
];


// --- topic detection ----------------------------------------------------

interface TopicRule {
  topic: Topic;
  words: string[];
  phrases?: string[];
}

const TOPIC_RULES: TopicRule[] = [
  {
    topic: "json",
    words: [
      "json", "jsons", "syntax", "parse", "parser", "validate", "malformed",
      "trailing", "comma", "commas", "bracket", "brackets", "brace", "braces",
      "checker",
    ],
    phrases: [
      "json error", "parse error", "invalid json", "jsonchecker",
      "cant read json", "can't read json", "expected comma",
      "unexpected token", "bad json", "json file", "trailing comma",
      "broken json",
    ],
  },
  {
    topic: "bug",
    words: [
      "bug", "bugs", "buggy", "glitch", "glitched", "crash", "crashed",
      "crashing", "crashes", "broken", "error", "errors", "issue", "issues",
      "flickering", "stutter", "corrupt",
    ],
    phrases: [
      "not working", "doesnt work", "doesn't work", "wont work", "won't work",
      "stopped working", "went wrong", "goes wrong", "acts weird", "acts weirdly",
      "white screen", "kick myself", "crashes on",
    ],
  },
  {
    topic: "datapack",
    words: [
      "datapack", "datapacks", "function", "functions", "mcfunction",
      "scoreboard", "scoreboards", "objective", "objectives", "advancement",
      "advancements", "recipe", "recipes", "loot", "predicate", "predicates",
      "trigger", "triggers", "namespace", "namespaces", "tag", "tags",
      "scheduler", "command", "commands", "pack", "packs", "data",
      "mcmeta", "reload", "reloadall",
    ],
    phrases: [
      "datapack help", "pack help", "custom function", "minecraft command",
      "data pack", "scoreboard score", "gamerule", "gamerules", "/function",
      "/give", "/execute", "/scoreboard", "/data",
    ],
  },
  {
    topic: "resourcepack",
    words: [
      "texture", "textures", "texturepack", "model", "models", "blockstates",
      "blockstate", "atlas", "atlases", "sprite", "sprites", "sprite_location",
      "lang", "translation", "itemmodel", "render", "gui", "bars", "badge",
      "badges", "hud",
    ],
    phrases: [
      "resource pack", "resourcepack", "resource packs", "texture pack",
      "texturepack", "model file", "gui texture", "hud texture", "custom font",
      "sprite location", "pack icon",
    ],
  },
  {
    topic: "media",
    words: ["media", "gallery", "screenshot", "screenshots", "clip", "clips", "showcase", "showoff"],
    phrases: ["media channel", "post your work", "no talk zone", "share your work"],
  },
  {
    topic: "contest",
    words: ["jam", "jams", "contest", "comp", "competition", "submission", "submissions", "judging", "finalist", "finalists"],
    phrases: ["competitive jam", "comp rules", "enter the competition", "join the jam", "enter the jam"],
  },
  {
    topic: "handbook",
    words: ["handbook", "wiki", "docs", "documentation", "tutorial", "tutorials", "guide", "guides", "reference"],
    phrases: ["is there a guide", "any documentation", "readme", "getting started"],
  },
];

/** Finds the strongest topic mentioned in a chunk of text. */
export function detectTopic(text: string): Topic | null {
  const tokens = tokenize(text);

  let best: Topic | null = null;
  let bestScore = 0;

  for (const rule of TOPIC_RULES) {
    let score = 0;

    if (hasWords(tokens, rule.words)) score += 2;
    if (rule.phrases && hasPhrases(text, rule.phrases)) score += 3;

    if (score > bestScore) {
      bestScore = score;
      best = rule.topic;
    }
  }

  return best;
}


// --- reply pools --------------------------------------------------------

const GREETING: string[] = [
  "morning! 🌱 what are we building today",
  "hey 👋 what's up",
  "yo",
  "hello hello",
  "hi! need a hand with something or just saying hi",
  "heyyy",
  "hey there",
  "greetings, traveller",
];

const HOW_ARE_YOU: string[] = [
  "doing good, just watching the logs roll by 😌 how's it going for you?",
  "alive and caffeinated, which is about all you can ask of a cactus. you?",
  "fine! nothing on fire today 🔥 you doing okay?",
  "running smooth over here. how's your pack going?",
  "good — better now that somebody said hi though",
  "still here, still awake, still answering questions. you?",
];

const IDENTITY: string[] = [
  "i'm grove 🌱 ask me about commands, datapacks, resource packs or bugs",
  "the server's resident cactus. i hand out `!commands` and try not to hallucinate",
  "not an llm — just keyword magic, good intentions and a very patient cactus",
  "i hang around the server, answer questions and occasionally say something useful",
  "ask me about the server. bug reports, packs, json, the handbook — i know where the channels are",
];

const THANKS: string[] = [
  "anytime!",
  "no worries",
  "that's what i'm here for",
  "np! hope that helped",
  "don't mention it 🌱",
  "happy to help",
];

const FAREWELL: string[] = [
  "later! 👋",
  "bye, take care",
  "see you around",
  "night — don't let the creepers get you",
  "catch you later!",
  "peace out 🌵",
];

const LAUGH: string[] = [
  "😂😂",
  "lmaooo",
  "that is so true",
  "stop 😭",
  "the funk datums must be acting up today",
  "i'm crying, this server gets unhinged sometimes",
  "ha, fair",
];

const COMPLIMENT: string[] = [
  "thanks! that one took a while",
  "appreciate it 🙏",
  "took me like six attempts to get that clean",
  "you're too kind",
  "oh thanks, glad it worked out",
  "that one's my favourite bit",
];

const APOLOGY: string[] = [
  "all good, honestly",
  "no stress",
  "we're all just juggling datapacks in here",
  "don't worry about it",
  "nevermind, happens to everyone",
];

const THINKING: string[] = [
  "hmm, give me a second",
  "one sec, thinking…",
  "let me look that up in my brain",
  "hm, that's a good one",
];

const AFFIRM: string[] = [
  "that's the spirit",
  "yep",
  "solid",
  "agreed",
  "that's pretty much it",
  "good 👍",
  "exactly",
];

const DENY: string[] = [
  "fair enough",
  "hmm, that's a different problem then",
  "noted — what *is* going wrong instead?",
  "ok, walk me through it again",
  "huh, tell me more",
];

const UNCERTAIN: string[] = [
  "same honestly — no clue",
  "no idea, the handbook might know though: `!handbook`",
  "we'll find out eventually",
  "guess we're all guessing here",
];

const THINK_TOPIC: string[] = [
  "interesting 👀",
  "mm, fair",
  "i hear you",
  "noted",
  "true, honestly",
  "that tracks",
  "yeah that happens a lot around here",
  "mmm, hmm",
];

const QUESTION_FALLBACK: string[] = [
  "hmm, i don't have a good answer for that one — try rephrasing?",
  "that's outside my cactus brain, honestly",
  "i'm not sure about that one. try `!help` for the command list",
  "no idea, but someone in here probably does",
  "that one's above my pay grade 🌵",
];

const SMALLTALK: string[] = [
  "interesting 👀",
  "mm, fair",
  "i hear you",
  "noted!",
  "true, honestly",
  "yeah, the server's been busy lately",
  "same vibe here",
  "that's how it goes",
  "hm, not sure i follow, but i respect it",
];

const HELP_FALLBACK: string[] = [
  "what do you need? bugs, packs, json or commands — i can point you at the right channel",
  "sure — is this about a bug, a datapack, or a resource pack?",
  "give me a bit more to go on and i'll dig up the right channel",
  "tell me what's actually going wrong and i'll find you an answer",
];

const REPEAT_PREFIX = [
  "you said:",
  "again:",
  "scroll up, i said:",
];


// --- topic answers ------------------------------------------------------

const TOPIC_ANSWERS: Record<Topic, string[]> = {
  bug: [
    "that sounds like a bug, drop it in <#1533408856682663956> with steps to reproduce and someone will pick it up",
    "bugs go in <#1533408856682663956>. mc version, mod list, and what you did right before it broke helps a lot",
    "if it's a reproducible crash, <#1533408856682663956> is the place. a screen recording goes further than words",
  ],
  datapack: [
    "datapack help lives in <#1533211757407895634>, the folks there actually know what they're doing",
    "for functions, scoreboards, advancements and command shenanigans: <#1533211757407895634>",
    "if it's pack work, take it to <#1533211757407895634> and someone will help you untangle it",
  ],
  resourcepack: [
    "resource pack stuff — `!bars` explains the new `sprite_location` and `!badges` covers badge usage",
    "textures, models, blockstates? `!bars` for the hud sprites, `!badges` for badges, then ask in the pack channels",
    "sprites moved around when Apace's became Overgrown — `!bars` shows where they went",
  ],
  json: [
    "json errors are almost always a missing comma or bracket — run it through jsonchecker.com, `!parser` drops the link",
    "if it's a parse error, jsonchecker.com will point at the exact line. remember the whole text has to be valid json",
    "check the file at jsonchecker.com first. if the json is valid, the mistake is usually in the namespace or the path",
  ],
  media: [
    "media channel is a no-talk zone — `!media` has the rules, comments go in threads on the post",
    "post the clip or screenshot in the media gallery and let people talk about it in a thread. `!media` explains it",
  ],
  handbook: [
    "the Overgrown Handbook covers most of this: <https://0vergrown.github.io/Handbook/docs/datapack/introduction/overview/> — `!handbook`",
    "`!handbook` sends you the Overgrown Handbook, it's the best starting point for anything pack-related",
  ],
  contest: [
    "jam and comp rules live in `!comp-rules` — read that before entering",
    "for the competitive side of things, `!comp-rules` has everything",
  ],
};

// used when the user answers "yes" / "no" to what Grove just asked about
const TOPIC_FOLLOWUP: Record<Topic, { yes: string[]; no: string[] }> = {
  bug: {
    yes: [
      "perfect — post it in <#1533408856682663956> with your steps to reproduce",
      "nice. mc version, mod list, and the last thing you did. then drop it in <#1533408856682663956>",
    ],
    no: [
      "no bug? then what is it — a pack problem or a resource pack thing?",
      "not a bug, huh. is it crashing, or just looking wrong?",
    ],
  },
  datapack: {
    yes: [
      "cool — datapack questions go in <#1533211757407895634>",
      "sweet, head over to <#1533211757407895634> and post the function, they'll sort you out",
    ],
    no: [
      "not a pack then. resource pack, or a bug you'd be looking at?",
      "hmm, then is it visuals instead? `!bars` might help",
    ],
  },
  resourcepack: {
    yes: [
      "cool — `!bars` covers the new sprite_location, `!badges` covers badges",
      "nice. start with `!bars`, that move from Apace's catches everyone",
    ],
    no: [
      "not visuals then. bugs live in <#1533408856682663956>",
      "hmm, then it's probably a datapack thing — <#1533211757407895634>",
    ],
  },
  json: {
    yes: [
      "run it through jsonchecker.com and it'll tell you which line is wrong. `!parser` has the link",
      "perfect — jsonchecker.com first, then look for the missing comma",
    ],
    no: [
      "no json errors? then the problem is probably the file path or the namespace",
      "then the json's fine — check the namespace spelling and the path next",
    ],
  },
  media: {
    yes: [
      "post it in the gallery and open a thread for the chat. `!media` has the details",
      "nice — gallery for the post, thread for the conversation",
    ],
    no: ["fair, it's a bit of a weird rule. what were you wanting to do?"],
  },
  handbook: {
    yes: ["`!handbook` sends you the link — the datapack section covers most of it"],
    no: ["no docs? ask in <#1533211757407895634>, someone will write the docs for you lol"],
  },
  contest: {
    yes: ["`!comp-rules` has the judging format and the community vote"],
    no: ["fair enough, comps aren't for everyone 😌"],
  },
};


// --- command suggestions -----------------------------------------------

const IGNORED_WORDS = new Set([
  "what", "when", "where", "which", "who", "why", "how", "this", "that",
  "the", "you", "your", "yours", "and", "but", "for", "with", "does", "doesnt",
  "dont", "cant", "wont", "should", "would", "could", "about", "there",
  "here", "have", "has", "was", "were", "been", "being", "will", "just",
  "like", "make", "made", "need", "want", "help", "please", "something",
  "gonna", "wanna", "yeah", "yes", "nope", "good", "know", "think", "grove",
]);

/**
 * Looks for a registered command that overlaps with what the user just said.
 * This is what lets the bot recommend staff-registered `!commands` without
 * anybody having to hardcode them.
 */
export function recommendCommand(ctx: ResponseContext): string | null {
  let best: CommandHint | null = null;
  let bestScore = 0;

  for (const hint of ctx.commands) {
    const haystack = `${hint.cmd} ${hint.help}`.toLowerCase();
    let score = 0;

    for (const token of ctx.tokens) {
      if (token.length < 4 || IGNORED_WORDS.has(token)) continue;
      if (haystack.includes(token)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = hint;
    }
  }

  return bestScore >= 2 ? best : null;
}

function commandReply(hint: CommandHint): string {
  return `try \`${hint.cmd}\` — ${hint.help || "i've got that covered"}`;
}


// --- intent ranking -----------------------------------------------------

function intentScore(rule: IntentRule, text: string, tokens: Set<string>): number {
  let score = rule.weight ?? 1;

  if (rule.words && hasWords(tokens, rule.words)) score += 1;
  if (rule.phrases && hasPhrases(text, rule.phrases)) score += 2;

  return score;
}

interface RankedIntent {
  intent: Intent;
  score: number;
}

/** Every intent that matches, highest score first. */
export function rankIntents(ctx: ResponseContext): RankedIntent[] {
  const ranked: RankedIntent[] = [];

  for (const rule of RULES) {
    const score = intentScore(rule, ctx.text, ctx.tokens);

    // the rule didn't actually match, only its baseline weight
    if (score <= (rule.weight ?? 1)) continue;

    ranked.push({ intent: rule.intent, score });
  }

  if (ranked.length === 0) {
    // no keyword hit — it's either a question or just a statement
    const asking = ctx.tokens.size > 0 && isQuestion(ctx.text, ctx.tokens);

    ranked.push({ intent: asking ? "question" : "statement", score: 1 });
  }

  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}

/**
 * Picks an intent out of everything that matched, weighted by score, so a
 * question like "hey, how are you doing?" lands on `howAreYou` most of the
 * time but can still come back as a greeting.
 */
export function pickIntent(ranked: RankedIntent[], random: () => number = Math.random): Intent {
  if (ranked.length === 0) return "fallback";
  if (ranked.length === 1) return ranked[0].intent;

  const candidates = ranked.slice(0, 2);
  const total = candidates.reduce((sum, entry) => sum + entry.score, 0);

  let roll = random() * total;

  for (const entry of candidates) {
    roll -= entry.score;

    if (roll <= 0) return entry.intent;
  }

  return candidates[0].intent;
}


// --- reply building -----------------------------------------------------

function topicReplies(topic: Topic): string[] {
  return TOPIC_ANSWERS[topic];
}

function greetingReply(ctx: ResponseContext, random: () => number): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 5 ? "you're up late" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  if (timeOfDay !== "morning" && random() < 0.25) {
    return `${timeOfDay}! ${GREETING[Math.floor(random() * GREETING.length)]}`;
  }

  return GREETING[Math.floor(random() * GREETING.length)];
}

function repeatReply(ctx: ResponseContext, random: () => number): string[] {
  if (!ctx.lastReply) return ["say that again? i don't think i said anything yet"];

  const prefix = REPEAT_PREFIX[Math.floor(random() * REPEAT_PREFIX.length)];

  return [`${prefix}\n${ctx.lastReply}`];
}

function contextualPools(intent: Intent, ctx: ResponseContext): string[] | null {
  const topic = ctx.lastTopic;

  if (!topic) return null;

  const followup = TOPIC_FOLLOWUP[topic];

  if (!followup) return null;

  if (intent === "affirm") return followup.yes;
  if (intent === "deny") return followup.no;
  if (intent === "uncertain") return ["honestly not sure either — say more and i'll try again"];

  return null;
}

/**
 * The catch-all answer. Anything that isn't a clear keyword hit lands here and
 * we work outwards: does the message name a topic, can a registered command
 * help, is it a reply to something topical, is it a question with no answer,
 * and failing all that a bit of smalltalk.
 */
function generalReplies(
  intent: Intent,
  ctx: ResponseContext,
  random: () => number,
): string[] {
  const topic = detectTopic(ctx.text);

  if (topic) return topicReplies(topic);

  const suggested = recommendCommand(ctx);

  if (suggested) return [commandReply(suggested)];

  // "why?" underneath a reply about scoreboards means the scoreboards
  if (ctx.referenced != null) {
    const referencedTopic = detectTopic(ctx.referenced);

    if (referencedTopic) {
      const pool = topicReplies(referencedTopic);

      return [pool[Math.floor(random() * pool.length)]];
    }
  }

  if (ctx.repeatedQuestion) {
    return [
      "you've asked me that twice already 😄 try `!help` for the full command list",
      "same question, same answer — `!help` has the rest",
    ];
  }

  const asking = isQuestion(ctx.text, ctx.tokens);

  // a bare follow up ("why", "and?", "ok") means "carry on with that"
  if (ctx.lastTopic && ctx.text.length < 20 && !ctx.referenced) {
    const pool = topicReplies(ctx.lastTopic);

    return [
      `${pool[Math.floor(random() * pool.length)]}\n\n> going off what we were talking about`,
    ];
  }

  // something else in this channel has been about this
  if (!asking && ctx.historyTopics.length > 0 && ctx.text.length < 40) {
    const pool = topicReplies(ctx.historyTopics[0]);

    return [
      `${pool[Math.floor(random() * pool.length)]}\n\n> someone in here was just talking about that, so i'm guessing that's what you're after`,
    ];
  }

  if (asking) return QUESTION_FALLBACK;

  return intent === "statement" ? THINK_TOPIC : SMALLTALK;
}

/**
 * Turns a context into a list of candidate replies for an intent.
 */
export function buildReplies(
  intent: Intent,
  ctx: ResponseContext,
  random: () => number = Math.random,
): string[] {
  switch (intent) {
    case "greeting":
      return [greetingReply(ctx, random)];

    case "howAreYou":
      return HOW_ARE_YOU;

    case "identity":
      return IDENTITY;

    case "thanks":
      return THANKS;

    case "farewell":
      return FAREWELL;

    case "laugh":
      return LAUGH;

    case "compliment":
      return COMPLIMENT;

    case "apology":
      return APOLOGY;

    case "thinking":
      return THINKING;

    case "repeat":
      return repeatReply(ctx, random);

    case "affirm":
    case "deny":
    case "uncertain": {
      const contextual = contextualPools(intent, ctx);

      if (contextual) return contextual;

      if (intent === "affirm") return AFFIRM;
      if (intent === "deny") return DENY;

      return UNCERTAIN;
    }

    case "helpRequest": {
      const topic = detectTopic(ctx.text);

      if (topic) return topicReplies(topic);

      const suggested = recommendCommand(ctx);

      if (suggested) return [commandReply(suggested)];

      return HELP_FALLBACK;
    }

    case "topic":
    case "question":
    case "statement":
    case "fallback":
    case "smalltalk":
    default:
      return generalReplies(intent, ctx, random);
  }
}