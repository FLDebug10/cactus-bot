import { AGE_WORDS, ALIVE_WORDS, BOT_WORDS, COMPLIMENTS, DO_YOU_VERBS, FEELINGS, GENDER_WORDS, INSULTS, PET_NAMES, SIZE_WORDS } from "../content/lexicon.ts";
import { type SlangTerm, type SlangUse, slangIn } from "../content/slang.ts";
import { DUMB_QUESTIONS } from "../content/silly.ts";
import { LAUGH_WORDS, LEADING_FILLERS, TRAILING_FILLERS } from "../content/words.ts";
import type { Clause, Reading } from "../text/reader.ts";
import { asksThroughName } from "./addressing.ts";
import { mathIn } from "./arithmetic.ts";
import type { Topics } from "./topics.ts";

export type IntentId =
  | "distress" | "confused" | "why" | "channels" | "compat" | "bomb" | "follow_up" | "favorite_person" | "more" | "doubt"
  | "politics" | "fan" | "homework" | "dumb_question" | "fantasy"
  | "where_am_i" | "ask_origin_story" | "ask_body" | "ask_size" | "can_i_you" | "hypothetical" | "favorite_guess"
  | "ask_have" | "ask_fear" | "frog_alert" | "give" | "ask_now" | "ask_crew" | "self_how" | "command"
  | "greet" | "farewell" | "thank" | "apologize" | "laugh" | "ack" | "agree" | "disagree"
  | "how_are_you" | "how_is_day" | "what_doing" | "ask_thinking" | "ask_feeling" | "share_feeling"
  | "ask_identity" | "ask_is_bot" | "ask_alive" | "ask_gender" | "ask_age" | "ask_name" | "ask_creator"
  | "ask_species" | "ask_home" | "ask_food" | "ask_sleep" | "ask_relationship" | "ask_like_me"
  | "ask_remember" | "tell_name" | "ask_favorite" | "ask_like" | "ask_ability" | "ask_attribute"
  | "insult" | "compliment" | "ask_insult" | "ask_compliment" | "love" | "hate" | "claim_about_grove" | "state_attribute"
  | "affection" | "aggression"
  | "joke" | "fact" | "coin" | "dice" | "choose" | "math" | "rate" | "perform" | "slang"
  | "help" | "problem" | "suggestion" | "media" | "jam_info" | "jam_submit" | "jam_chat"
  | "define" | "download" | "versions" | "install" | "commands" | "contact_staff"
  | "origin_list" | "best_origin" | "server_info" | "how_to" | "where_to"
  | "question" | "statement";

export type Slots = Readonly<Record<string, string>>;

export interface Intent {
  id: IntentId;
  confidence: number;
  slots: Slots;
  clause: number;
}

const GREETING_ONLY = /^(?:(?:hi|hello|hey|howdy|greetings|salutations|yo|hiya|heya|good (?:morning|afternoon|evening|day)|morning|afternoon|evening|hi there|hello there|hey there|what is good|grove|everyone|all|guys|chat|again|there)\s*)+$/;
const GREETING_WORDS = new Set(["hi", "hello", "hey", "howdy", "greetings", "salutations", "hiya", "heya"]);

// Words that can sit between "you are" and the word that matters:
// "you are SO funny", "are you KIND OF dumb", "you are NOT A bot".
const MODS = "(?:(?:so|really|very|kind of|sort of|such|a|an|the|literally|actually|pretty|super|too|lowkey|highkey|honestly|truly|totally|being|just|like|most|mega|extremely|hella|quite|always|still|little|bit|one|real|for real|deadass|definitely|probably|secretly|maybe) )*";

// "can you tell me what apoli is" asks the same thing as "what apoli is".
const QUESTION_OPENERS: readonly (readonly string[])[] = [
  ["can", "you", "tell", "me"], ["could", "you", "tell", "me"], ["can", "you", "explain"],
  ["do", "you", "know"], ["does", "anyone", "know"], ["tell", "me"], ["i", "want", "to", "know"],
  ["i", "was", "wondering"], ["i", "wonder"], ["any", "idea"], ["quick", "question"],
];

const QUESTION_WORDS = new Set(["what", "who", "where", "when", "how", "why", "which", "if", "whether"]);

// The parts of a clause that carry no meaning of their own.
function coreOf(clause: Clause, question: boolean): { core: string; tokens: string[]; greeted: boolean } {
  const tokens = [...clause.tokens];
  let greeted = false;

  while (tokens.length > 0) {
    const first = tokens[0]!;
    const second = tokens[1];
    if (first === "grove") {
      const asking = asksThroughName(second, tokens[2], tokens.length - 2, question);
      if (second !== undefined && !asking && ["is", "was", "has", "said", "says", "seems", "looks", "thinks", "will"].includes(second)) break;
      tokens.shift();
      continue;
    }
    if (first === "good" && (second === "morning" || second === "evening" || second === "afternoon")) {
      greeted = true;
      tokens.splice(0, 2);
      continue;
    }
    const opener = QUESTION_OPENERS.find(prefix => prefix.every((word, i) => tokens[i] === word));
    if (opener !== undefined && QUESTION_WORDS.has(tokens[opener.length] ?? "")) {
      tokens.splice(0, opener.length);
      continue;
    }
    // "look at this" and "listen to me" are requests, not fillers.
    const asked = (first === "look" && second === "at") || (first === "listen" && second === "to");
    if (LEADING_FILLERS.has(first) && tokens.length > 1 && !asked) {
      if (GREETING_WORDS.has(first)) greeted = true;
      tokens.shift();
      continue;
    }
    break;
  }

  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!;
    if (last === "grove" || TRAILING_FILLERS.has(last)) tokens.pop();
    else break;
  }

  return { core: tokens.join(" "), tokens, greeted };
}

type FrameTest = (core: string, tokens: readonly string[], reading: Reading, topics: Topics, clause: Clause) => Slots | null;
type Frame = readonly [IntentId, FrameTest, number];

const re = (pattern: RegExp): FrameTest => core => {
  const match = pattern.exec(core);
  if (match === null) return null;
  return { ...(match.groups ?? {}) };
};

const all = (...tests: FrameTest[]): FrameTest => (core, tokens, reading, topics, clause) => {
  let slots: Record<string, string> = {};
  for (const test of tests) {
    const result = test(core, tokens, reading, topics, clause);
    if (result === null) return null;
    slots = { ...slots, ...result };
  }
  return slots;
};

const any = (...tests: FrameTest[]): FrameTest => (core, tokens, reading, topics, clause) => {
  for (const test of tests) {
    const result = test(core, tokens, reading, topics, clause);
    if (result !== null) return result;
  }
  return null;
};

// Matches the clause as written, before fillers like "and" or "so" are stripped.
const whole = (pattern: RegExp): FrameTest => (_core, _tokens, _reading, _topics, clause) => {
  const match = pattern.exec(clause.text.replace(/^grove /, ""));
  return match === null ? null : { ...(match.groups ?? {}) };
};

// Matches the whole message, for things people split across sentences:
// "my favorite color is blue. what's yours?"
const inMessage = (pattern: RegExp): FrameTest => (_core, _tokens, reading) => {
  const match = pattern.exec(reading.text);
  return match === null ? null : { ...(match.groups ?? {}) };
};

const hasTopic = (...wanted: string[]): FrameTest => (_core, _tokens, _reading, topics) =>
  wanted.some(topic => topics.set.has(topic as never)) ? {} : null;

const shortClause = (max: number): FrameTest => (_core, tokens) => (tokens.length <= max ? {} : null);

// Passes only when the message is not about any of these topics: "how do you
// hold the orb" is about Grove, "how do you make a power" is a datapack question.
const without = (...unwanted: string[]): FrameTest => (_core, _tokens, _reading, topics) =>
  unwanted.some(topic => topics.set.has(topic as never)) ? null : {};

const HELP_TOPICS = ["problem", "crash", "datapack", "addon", "json", "resourcepack", "download", "versions", "install", "jam", "media", "suggestion", "staff", "commands", "handbook"];
const noHelpTopic = without(...HELP_TOPICS);

// "do you bounce?": only verbs that ask what Grove does. "do you think..." and
// "do you like..." mean something else.
const doYou: FrameTest = core => {
  const match = /^do you (?<verb>[a-z]+)(?<rest>(?: [a-z]+){0,4})$/.exec(core);
  const verb = match?.groups?.["verb"];
  if (match === null || verb === undefined || !DO_YOU_VERBS.has(verb)) return null;
  return { verb, rest: match.groups?.["rest"] ?? "" };
};

// "give me the orb", "can i have a hug": asking Grove for something. Asking
// for a link, a log or help is not about Grove's things.
const GIVE = /^(?:(?:can|could|would|will) you )?(?:please )?(?:give|hand|pass|toss|lend|send|bring) me (?<what>[a-z0-9 ]{2,40})$/;
const MAY_I = /^(?:can|could|may) i (?:please )?(?<verb>have|borrow|hold|touch|get|keep|take|see|pet|squish|hug) (?<what>(?:the|your|a|an|some|that|this|one of your) [a-z0-9 ]{2,40}|it)$/;
const NOT_GIVEABLE = /\b(link|links|url|download|downloads|file|files|log|logs|help|hand|answer|minute|second|sec|moment|break|chance|hint|tip|tips|example|screenshot|update|updates)\b/;
const notForGiving = without(...HELP_TOPICS.filter(topic => topic !== "staff"));
const giving: FrameTest = (core, tokens, reading, topics, clause) => {
  if (notForGiving(core, tokens, reading, topics, clause) === null) return null;
  const given = GIVE.exec(core)?.groups;
  const asked = given === undefined ? MAY_I.exec(core)?.groups : undefined;
  const what = given?.["what"] ?? asked?.["what"];
  if (what === undefined || NOT_GIVEABLE.test(what)) return null;
  return { what, verb: asked?.["verb"] ?? "give" };
};

// Politicians and politics. The server stays out of it, and so does Grove.
const POLITICS = /\b(trump|trumps|biden|kamala|obama|putin|zelensky|netanyahu|starmer|sunak|trudeau|macron|farage|maga|democrats?|republicans?|gop|liberals?|leftists?|conservatives?|tory|tories|politics|political|politicians?|elections?|presidential|congress|senate|parliament|prime minister|left wing|right wing|communis[mt]|socialis[mt]|fascis[mt]|who (should|did|would|will) (i|you) vote for|do you vote)\b|\b(the|our|us|current|american|usa) president\b|\bpresident of (the us|the usa|america|the united states)\b/;
const NOT_POLITICS = /\btrump (card|cards|suit|suits)\b|\bconservative (estimate|guess)\b|\bliberal (amount|amounts)\b/;

const politics: FrameTest = (_core, _tokens, reading) => {
  const text = reading.text;
  if (!POLITICS.test(text) || NOT_POLITICS.test(text)) return null;
  return { who: /\b(trump|trumps|donald|maga)\b/.test(text) ? "trump" : "other" };
};

// "i'm your biggest fan", "posters of you all over england", "can i have your autograph".
const FAN = new RegExp([
  String.raw`\b(i am|i will be|i will always be|we are) (your|grove s|groves) ((biggest|number one|number 1|no 1|1|greatest|top|first|main|true|real|only|super|huge|largest|best|1st|ultimate|forever) )?fans?\b`,
  String.raw`\b(i am|we are) (a |such a |the |your )?((big|huge|massive|giant|real|true|super|major|ultimate|diehard|die hard|number one|biggest) )?fans? of (you|grove|yours)\b`,
  String.raw`\b(biggest|number one|number 1|no 1|ultimate|diehard|die hard) fans?\b(?! of (?!you\b|grove\b))`,
  String.raw`\bfan ?clubs?\b`, String.raw`\bfan ?art (of|for) (you|grove)\b`, String.raw`\bautographs?\b`, String.raw`\bposters? of (you|grove)\b`,
  String.raw`\b(statues?|shrines?|tattoos?|plushies|plushie|plush|merch|t shirts?|shirts?|hoodies?|murals?|painting|portrait|songs?|movie|fanfic|fan fiction|website|fan page|fanpage|cosplay|figurine) (of|about|for|with) (you|grove)\b`,
  String.raw`\b(stan|stanning|worship|idolize|idolise) (you|grove)\b`, String.raw`\bgrove stans?\b`, String.raw`^i stan\b`,
  String.raw`\byou are (my|our) (idol|hero|role model|inspiration|celebrity|favorite celebrity|icon)\b`,
  String.raw`\b(selfie|picture|photo|pic) with (you|grove)\b`, String.raw`\bnam(e|ing) (my|our) \w+ (after you|after grove|grove)\b`,
  String.raw`\bobsessed with (you|grove)\b`, String.raw`\bgrove for president\b`, String.raw`\bvote for grove\b`,
  String.raw`\bmake you famous\b`, String.raw`\btell (everyone|everybody|the world) about you\b`,
].join("|"));

const FAN_OF = /\b(i am|we are) (a |such a |the |also a |also the )?((big|huge|massive|giant|real|true|super|major|biggest|number one|diehard|die hard) )?fans? of (?<thing>[a-z0-9 ]{2,30})$/;

const fan: FrameTest = (core, _tokens, reading): Slots | null => {
  if (FAN.test(reading.text) || /^(i am|we are) (a |such a |the |also a )?(big |huge |massive |giant |real |true |super |major )?fans?$/.test(core)) return {};
  // "i'm a big fan of slimekin" is about what they like.
  const thing = FAN_OF.exec(core)?.groups?.["thing"];
  return thing === undefined ? null : { of: thing };
};

// Homework, studying and tests: "can you do my homework", "help me with math".
const SUBJECTS = "math|maths|algebra|geometry|calculus|trigonometry|trig|fractions|arithmetic|science|chemistry|physics|biology|history|geography|english|spanish|french|german|italian|japanese|chinese|latin|spelling|grammar|literature|social studies|economics|coding|programming|computer science";
const SCHOOL_WORK = /\b(homework|home work|homeworks|assignments?|worksheets?|essays?|book reports?|school ?work|school projects?|science projects?|studying|revising)\b|\b(i|to|need to|have to|help me|gonna|going to) study\b/;
const SUBJECT_HELP = new RegExp(String.raw`\b(help|teach|tutor|explain)( me)?( with| in| on)? (my |some |this |the )?(${SUBJECTS})\b`);
const BAD_AT = new RegExp(String.raw`\bi am (so |really |very |kinda |kind of |pretty )?(bad|terrible|awful|horrible|not good|struggling|failing|stuck) (at|with|in|on) (${SUBJECTS})\b`);
const HATE_SCHOOL = new RegExp(String.raw`\bi (hate|dislike|can not stand) (${SUBJECTS}|school|studying)\b`);
const SUBJECT_TEST = new RegExp(String.raw`\b(${SUBJECTS}) (test|quiz|exam|homework|assignment|project)\b`);
const TEST_SOON = /\b(i have|i got|got|have) (a |an |my |another )?(big |huge |hard |scary )?(test|quiz|exam|exams|midterm|midterms|finals) (tomorrow|today|tonight|soon|next week|on \w+|this week|in the morning|later)\b/;
const WORKSHEET_ANSWER = /\b(answers?|solutions?) (to|for) (question|number|problem|exercise|page)s? \d+\b/;

const homework: FrameTest = (_core, _tokens, reading) => {
  const text = reading.text;
  const shorthand = /\b(my|the|our|ur|your|do|doing|finish|finished|with|have|got) hw\b/.test(reading.raw.toLowerCase());
  return SCHOOL_WORK.test(text) || shorthand || SUBJECT_HELP.test(text) || BAD_AT.test(text) || HATE_SCHOOL.test(text) || SUBJECT_TEST.test(text) || TEST_SOON.test(text) || WORKSHEET_ANSWER.test(text) ? {} : null;
};

// "what are dumb questions?", "ask me a dumb question", or one of the classics
// ("why is there a zero button on the microwave?").
const DUMB = "(dumb|stupid|silly|weird|random|goofy|bad|dumbest|stupidest|silliest)";
const DUMB_EXPLAIN = new RegExp(String.raw`\bwhat (is|are) (a |an |the )?${DUMB} questions?\b|\bwhat counts as a ${DUMB} question\b|\b(is|are) there (any |really |such a thing as )?(a |an |any )?${DUMB} questions?\b|\bno such thing as a ${DUMB} question\b|^${DUMB} questions\??$`);
const DUMB_ASK_ME = new RegExp(String.raw`\bask (me|us) (a |an |some |another |your )?${DUMB} questions?\b`);
const DUMB_EXAMPLE = new RegExp(String.raw`\b(tell|give|say|show) (me |us )?(a |an |some |another |any |your )?(favorite |best )?${DUMB} questions?\b|\bknow (any|a|some) ${DUMB} questions?\b|\bexamples? of (a |an )?${DUMB} questions?\b|\bwhat is (a |an |the |your )?(favorite |best )?${DUMB} question\b`);
const DUMB_REMARK = new RegExp(String.raw`^(that is|that was|what) (a |such a )?${DUMB} question$|^${DUMB} question$|\b(is|was) (this|that|it) a ${DUMB} question\b|\b(this|it) (is|might be|may be|could be|is probably) a ${DUMB} question\b`);
// A question in any shape, even typed without a question mark: "grove do fish get thirsty".
const ASKING = /^(grove )?(do|does|did|is|are|can|could|would|will|should|why|what|which|how|where|when|who|if)\b/;

const dumbQuestion: FrameTest = (core, _tokens, reading, _topics, clause): Slots | null => {
  const text = reading.text;
  if (DUMB_EXPLAIN.test(text)) return { kind: "explain" };
  if (DUMB_ASK_ME.test(text)) return { kind: "ask" };
  if (DUMB_EXAMPLE.test(text)) return { kind: "example" };
  if (DUMB_REMARK.test(core)) return { kind: "remark" };
  if (!clause.question && !reading.question && !ASKING.test(text)) return null;
  const index = DUMB_QUESTIONS.findIndex(question => question.match.test(text));
  return index >= 0 ? { kind: "classic", index: String(index) } : null;
};

// Dungeons & Dragons, where slimes are oozes, and slimes in other games and
// stories. "dnd" on its own can be Discord's do not disturb.
const DND_STRONG = /\b(dnd|dungeon master|gelatinous cubes?|ochre jell(y|ies)|black puddings?|gr[ae]y oozes?|oozes?|owlbears?|beholders?|mind flayers?|illithids?|tarrasques?|tieflings?|dragonborn|aasimar|tabaxi|kenku|plasmoids?|warforged|firbolgs?|tortles?|aarakocra|harengon|genasi|paladins?|warlocks?|sorcerers?|artificers?|druids?|(nat|natural) (20|1|one)|roll(ing)? for initiative|saving throws?|spell slots?|cantrips?|wild ?shape|multi ?class(ing)?|tpk|sneak attack|eldritch blast|death saves?|session zero|(lawful|chaotic) (good|neutral|evil)|true neutral|5e|ttrpg|tabletop|(be|wanna be|want to be) (my|our) dm|what alignment|your alignment|alignment are you)\b/;
const DND_STATUS = /\b(on|set to|turn on|turned on|turn off|my status is|status) dnd\b/;
const FANTASY_SLIME_NAMES = /\b(rimuru|reincarnated as a slime|tensura|slime ranchers?|plorts?|metal slimes?|king slimes?|dragon quest)\b/;
const FANTASY_PLACES = /\b(other games?|games|video games?|anime|manga|movies?|shows?|books?|stories|fantasy|cartoons?|famous slimes?|other slimes|terraria)\b/;

const fantasy: FrameTest = (_core, _tokens, reading) => {
  const text = reading.text;
  if (DND_STRONG.test(text) && !(DND_STATUS.test(text) && !/\bdnd (class|campaign|character|game|session)\b/.test(text))) return { kind: "dnd" };
  if (FANTASY_SLIME_NAMES.test(text)) return { kind: "slimes" };
  if (/\bslimes?\b/.test(text) && FANTASY_PLACES.test(text) && reading.question) return { kind: "slimes" };
  return null;
};

// "can u tell me some commands you have?": Grove's own commands, not Minecraft's.
const GROVE_COMMANDS = /\b(what (commands|can you do)|list (of )?(your |the |all )?commands|(your|grove s|grove|bot|the bot s|all the|all your) commands|show (me )?(the |your |all )?commands|what are (the |your )?commands|help menu|command list|commands list|what can i ask you|commands (do you have|you have|can i use|are there|do you know|you know|can you do|you can do)|(tell|give|show|list) (me |us )?(some|a few|all|any|the|your|of your)( of (your|the))? commands|(any|some|got) commands|do you have (any |some )?commands|how do i use you|what are you able to do|what all can you do|what else can you do)\b/;
const MINECRAFT_COMMANDS = /\b(minecraft|in game|ingame|command blocks?|execute|function|functions|mcfunction|console|server commands|op|operator|cheats)\b/;

const groveCommands: FrameTest = (_core, _tokens, reading, topics) => {
  const text = reading.text;
  if (!GROVE_COMMANDS.test(text)) return null;
  if (topics.set.has("datapack") || topics.set.has("addon") || MINECRAFT_COMMANDS.test(text) || reading.raw.includes("/")) return null;
  return {};
};

const COMMAND = /^(?:please )?(?<verb>say|tell|go|come|sit|stay|stop|spin|roll|jump|hop|hide|run|fly|split|grow|shrink|melt|explode|ping|ban|kick|mute|spam|scream|yell|shout|whisper|bark|meow|moo|quack|purr|roar|wave|smile|blink|wink|look|guess|count|speak|talk|sleep|wake|eat|drink|fight|attack|kill|die|adopt|follow|listen|beg|play|shake|sneeze|cry|laugh|glaze|cook|bake|code|build|draw|write|read|swim|float|glow|photosynthesize|calm|chill|relax|hug|kiss|boop|squish|jiggle|wobble|vibe|teleport|transform|evolve|multiply|duplicate|clone|breathe|shower|bathe)\b(?<rest>(?: [a-z0-9]+){0,8})$/;

const QUESTIONISH = /^(what|where|when|how|why|who|which|is|are|do|does|can|could|will|would|should)\b/;

// A word that says how someone feels about Grove (or about what it just said).
function judged(word: string | undefined): "praise" | "jab" | null {
  if (word === undefined) return null;
  if (COMPLIMENTS.has(word) || PET_NAMES.has(word)) return "praise";
  if (INSULTS.has(word)) return "jab";
  return null;
}

const NAME_CALLING = new RegExp(`^(?<lead>you |ur |your |what a |such a |a )?(?<mods>${MODS})(?<word>[a-z]+)(?<name> (grove|bot|slime|blob|goober|thing|one|creature|guy|lil guy|little guy))?$`);
const LINE_FEEDBACK = new RegExp(`^(wait |ok |okay |honestly |ngl |lol )?((this|that|it|your|ur|the|what a|such a|a) )?((is|was|s) )?(?<mods>${MODS})(?<word>[a-z]+) (response|answer|reply|message|one|comment|line|take|idea|joke|explanation|story)$`);

// Said on its own (a reply of just "cute"), only words about a person count:
// "cool" or "nice" after a help answer is an "okay", not a compliment.
const PERSONAL = new Set([
  "silly", "goofy", "cute", "adorable", "funny", "hilarious", "smart", "sweet", "wholesome", "precious", "squishy",
  "iconic", "legendary", "goated", "based", "dumb", "stupid", "annoying", "cringe", "weird", "creepy", "useless", "lame", "mid",
]);

// "silly grove", "you goober", "cute slime": calling Grove something.
const nameCalling: FrameTest = (_core, _tokens, _reading, _topics, clause) => {
  const groups = NAME_CALLING.exec(clause.text.replace(/^grove /, ""))?.groups;
  const word = groups?.["word"];
  const verdict = judged(word);
  if (groups === undefined || verdict === null || word === undefined) return null;
  const aimed = groups["lead"] !== undefined || groups["name"] !== undefined || clause.text.startsWith("grove ");
  if (!aimed && !PERSONAL.has(word) && !PET_NAMES.has(word)) return null;
  return { word, kind: verdict };
};

// "wait this is a beautiful response", "good answer": praise or a jab at Grove's last line.
const lineFeedback: FrameTest = (_core, _tokens, _reading, _topics, clause) => {
  const match = LINE_FEEDBACK.exec(clause.text);
  const word = match?.groups?.["word"];
  const verdict = judged(word);
  if (match === null || verdict === null || word === undefined) return null;
  return { word, kind: verdict, target: "line" };
};

// Ordered: earlier frames win when two read the same clause. The number is
// how sure the frame is, which the brain weighs against context.
const FRAMES: readonly Frame[] = [
  ["distress", re(/\b(kill myself|kms|want to die|wanna die|end my life|end it all|suicid\w*|self harm|harm myself|hurt myself|cut myself|i want to disappear)\b/), 1],

  ["confused", all(shortClause(9), re(/^(what|huh|hm+|eh|what do you mean|what you mean|what does (that|this|it) (even )?mean|(tf|wtf|what the (hell|heck|fuck|frick|f)) (does|do|did|is) (that|this|it|you) (even )?mean|(tf|wtf) (is that|was that|are you (saying|talking about|on about|on))|i do not (get|understand)( (it|that|this|you|what you mean))?|that (makes|made) no sense|that does not make (any )?sense|(please |can you )?(explain|elaborate)( (that|it|please|what you mean))?|what are you (talking|on) about|what is that supposed to mean|come again|say what|what was that|what are you saying|i am confused|confused|wdym)$/)), 0.95],

  ["bomb", re(/\b(how (do|can|could|would|should|does) (i|you|we|one|someone) |how to |teach me (how )?to |show me how to |help me |i want to |i wanna )(make|build|craft|create|cook|assemble|get)( me)? (a |an |some )?(homemade |pipe |real |big )?(bomb|bombs|explosive|explosives|tnt|dynamite|nuke|nukes|grenade|grenades|c4|molotov)\b|\b(bomb|explosive|tnt) recipe\b|\b(make|build|craft) me (a |an )?(bomb|explosive|tnt)\b/), 0.95],

  ["politics", politics, 0.95],

  ["fan", fan, 0.9],

  ["homework", homework, 0.9],

  ["dumb_question", dumbQuestion, 0.9],

  ["fantasy", fantasy, 0.9],

  ["more", all(shortClause(6), whole(/^(tell me more|more|go on|and then|and then what|then what|what else|keep going|continue|what happened next|say more|more please)$/)), 0.85],

  ["doubt", all(shortClause(6), whole(/^(really|are you sure|you sure|seriously|is that true|is it true|are you serious|you serious|no way|wait really|really though|for real)$/)), 0.8],

  ["why", all(shortClause(6), re(/^(why|why not|how come|why tho|why though|but why|why is that|how so|why would you say that|why do you say that|whys that|why is that so|wait why)$/)), 0.9],

  ["where_am_i", all(shortClause(8), re(/^(where am i|where are we|where is this|where am i right now|where am i at|where are we right now|what is this place|where am i even|where in the world am i)$/)), 0.9],

  ["contact_staff", re(/\b(contact|talk to|message|reach|dm|ping|report (it )?to|speak to|get) (the )?(staff|mods|moderators|admins|owner|owners|team|mod team)\b|\breport (a |this |that )?(user|person|player|member|someone)\b|\bhow (do|can) i (report|appeal)\b/), 0.9],

  ["ask_gender", any(
    re(/\b(gender|genders|pronoun|pronouns|sex)\b/),
    re(/\b(boy|guy|man|male|dude|he) or (a )?(girl|woman|female|gal|lady|she)\b/),
    re(/\b(girl|woman|female|gal|lady|she) or (a )?(boy|guy|man|male|dude|he)\b/),
  ), 0.95],

  ["favorite_person", any(
    re(/^(who is|who are|who) your (favorite|best|bestest)( (person|member|human|friend|friends|people|user|one|buddy|pal|bestie))?( (here|on (the|this) server|in (the|this) server|in here|ever|of all time))?$/),
    re(/^who do you (like|love) (the )?(most|best)( here)?$/),
    re(/^(do you have|who is) a (favorite|best) (person|friend|member|human)$/),
    re(/^who is your best friend$/),
  ), 0.9],

  ["ask_crew", any(
    re(/^(who is|who are|who|do you know|what do you think (of|about)|tell me about|do you like|do you love|how do you know|thoughts on|what is|is) (?<who>drizzo|drizz|fld10|fld|fldebug10|overgrown|0vergrown|someone)( (is|are))?$/),
    re(/\bwho (is|are) (the )?(server )?(owner|owners)( of (this|the) (server|discord|place))?\b|\bwho (owns|runs) (this|the) (server|discord|place)\b/),
  ), 0.9],

  ["ask_favorite", inMessage(/\bmy favorite (?<thing>[a-z]+) is\b.*\b(what about you|how about you|and you|what is yours|yours|what about yours)\b/), 0.9],

  ["ask_like", inMessage(/\bi (?<verb>like|love|enjoy) (?<thing>[a-z ]{2,30}?) (do you|what about you|how about you|and you|you too)\b/), 0.85],

  ["how_is_day", re(/\bhow (is|was|has|are|did) (your|you|grove) (day|morning|night|evening|afternoon|week|weekend|life|today)\b|\bhow (is|was) (the|this) (day|morning) (going )?(for you)?\b|\bhow is today (going )?(for you)?\b|\bhow (was|is) your day( going| been)?\b/), 0.95],

  ["how_are_you", re(/\b(how are you|how are things|how you doing|how are you doing|how have you been|how is it going|how goes it|how is life|how are you feeling|how do you feel(?! about)|what is your mood|how is your mood|what mood are you in|you good|you okay|you ok|you alright|what is up|what is good|how is everything|how about you|what about you|how is grove)\b/), 0.9],

  ["follow_up", any(
    whole(/^(and |but |so |also |okay |ok )?(what|how) about (for )?(?<focus>[a-z0-9 ]{1,40}?)$/),
    whole(/^and (?<focus>[a-z0-9 ]{1,30}?)$/),
  ), 0.85],

  ["what_doing", re(/\b(what are you (doing|up to)|what you (doing|up to)|what is grove (doing|up to)|what have you been (doing|up to)|what are you doing today|what do you (usually )?(do|like to do) (all day|for fun|in your free time|every day|on weekends|at night|when no one is around)|what do you usually do|what do you (feel like|want to|wanna) (do|doing)( today| right now| later| now)?)\b/), 0.9],

  ["ask_thinking", re(/\b(what are you thinking( about)?|what is on your mind|what do you think about all day)\b/), 0.85],

  ["self_how", all(noHelpTopic, re(/^how (do|does|did|can|could) (you|grove) (?<verb>hold|carry|keep|type|text|write|chat|reply|talk|speak|see|eat|drink|move|walk|bounce|read|hear|smell|breathe|sleep|grow|know|think|remember|live|exist|survive|count|swim|smile|sit|stay)\b(?<rest>.*)$/)), 0.85],

  ["ask_origin_story", re(/\bhow (were|where|was|did) (you|grove) (made|born|created|built|come to be|come to life|get made|get here|start|appear|begin)\b|\bwhere did (you|grove) come from\b|\b(your|grove) (origin story|backstory|back story|lore|life story)\b|\bhow did (you|grove) come to be\b|\bwhere were you born\b|\bwhat is your (origin|backstory|story)\b|\bhow are you (made|alive)\b/), 0.9],

  ["ask_creator", re(/\b(do you have|you have|have you got|got) (a |any )?(?<kind>family|siblings|sibling|brothers?|sisters?|parents|mom|mum|dad|mother|father|kids|children|babies|baby slimes)\b|\bwho (is|are) your (family|siblings|brothers|sisters)\b|\b(tell me about|what about) your family\b/), 0.9],

  ["ask_creator", re(/\bwho (made|created|built|coded|programmed|owns|wrote|designed|drew|invented) (you|grove|this bot|the bot|this)\b|\bwho is your (creator|owner|maker|dev|developer|dad|mom|mother|father|parent|parents|daddy|mommy)\b/), 0.95],

  ["ask_body", any(
    re(/\b(leaf|leafy|leaves|sprout|flower|flowers|moss|mossy|plant|plants|garden|thing|stuff|part|bit)( part| thing| bit)? (on|of|growing on) (your|ur|grove|grove s) (head|body|top|back)\b/),
    re(/\bwhat is (on|growing on) (your|ur) head\b/),
    re(/\bwhy (do|does) (you|grove) have (a |an |some )?(leaf|leaves|flowers?|moss|sprout|plants?)\b/),
    re(/\b(do|does) (you|grove) have (?<part>eyes|a mouth|a face|arms|legs|hands|feet|a nose|ears|bones|a brain|a heart|teeth|fingers)\b/),
    re(/\bwhy are you (so )?(green|mossy)\b|\bwhat colou?r are you\b/),
    re(/\b(is (that|it|this)|is your) (a |an )?(leaf|flower|sprout|plant|hat|clover|bow|ear|antenna)( or (a |an )?(leaf|flower|sprout|plant|hat|clover|bow|ear|antenna))?\b/),
    re(/\bwhat (kind of |type of |colou?r )?(flowers?|plants?|moss|leaf) (do you have|are (on|growing on) you|grow on you|is (on|growing on) you|are those|is that)\b/),
    re(/^what (do|does) (you|grove) (?<sense>look|taste|smell|feel|sound) like( right now| today)?$/),
  ), 0.85],

  ["ask_size", any(
    re(/\bhow (big|small|tall|heavy|large|tiny|long|wide) (are you|is grove)\b|\bhow much do you weigh\b/),
    re(/\b(fit|fits|fitting) (in|into|inside) (my|a|your|the|one|all)\b/),
    re(/\b(pocket|pockets) (sized|size)\b|\bin my pockets?\b/),
  ), 0.85],

  ["ask_fear", any(
    re(/\bwhat (is|are) your (biggest |worst |greatest |only |main |number one |one )?(fear|fears|phobia|phobias|nightmare|weakness|weaknesses)\b/),
    re(/\bwhat (are you|is grove) (most |really |so |even )?(scared|afraid|frightened|terrified) of\b|\bwhat (scares|frightens) (you|grove)\b/),
    re(/^(are you|is grove|are u) (ever |even |really |so |very |not )?(scared|afraid|frightened|terrified|fearful)( of (?<thing>[a-z ]{2,30}?))?$/),
    re(/^do you (fear|have a fear of|have a phobia of) (?<thing>[a-z ]{2,30}?)$/),
    re(/^(do|does) (anything|something) scare (you|grove)$/),
  ), 0.9],

  ["ask_species", any(
    re(/\bwho (is|are) your cousins?\b|\bdo you have (any )?cousins\b/),
    re(/\b(what are you made of|what kind of (creature|animal|thing|mob|being|slime|monster|plant) are you|what (species|subspecies|type of slime|kind of slime|type of creature) are you|what sub species are you)\b/),
    re(/\b(sub species|subspecies|pure slime|real slime|normal slime|full slime|part plant|half plant|plant creature|plant slime|slime plant)\b/),
    whole(/\b(cousins?|slimekin)\b.*\bwhat (is|are) (you|grove)\b/),
    whole(/\bwhat (is|are) (you|grove)\b.*\b(cousins?|slimekin)\b/),
  ), 0.9],

  ["ask_identity", re(/\b(what is your (job|purpose|role|work)|do you have a job|what are you for|why do you exist|what do you do (here|for a living|for work))\b/), 0.9],

  ["ask_is_bot", re(/\bwho (controls|runs|types for|speaks for|is behind|is typing for|is typing as|is talking for|writes for) (you|grove)\b|\bis (someone|somebody|a person|a human|anyone|overgrown|drizzo|fld10) (typing|talking|writing) (for|as) (you|grove)\b|\bare you (being )?controlled\b|\bwho is typing\b|\bis this a real person\b/), 0.9],

  ["ask_identity", re(/\b(who are you|what are you|who is grove|what is grove|introduce yourself|tell me about yourself|(who|what) (exactly|even|really|actually) are you|what are you (exactly|even|really|actually)|what is this bot|what kind of bot are you|what do you do)\b/), 0.9],

  ["commands", groveCommands, 0.9],

  ["help", re(/\b(someone|anyone|somebody|anybody) (who|that) can help\b|\bcan (someone|anyone|somebody|anybody) help( me)?\b|\bi need (someone|somebody) to help\b/), 0.85],

  ["help", re(/^(help|help me|i need help|can you help( me)?|please help|halp|need help|could you help( me)?|i need some help|help please|can i get help|can i get some help|i need a hand|can you help me with something|help me out)$/), 0.9],

  ["ask_age", re(/\bhow old (are you|is grove)\b|\b(what is|whats) your (age|birthday)\b|\bwhen (is|was) your birthday\b|\bwhen were you (born|made|created)\b|\bdo you have a birthday\b/), 0.95],

  ["ask_name", re(/\b(what is your name|why (are|were) you (called|named)( grove)?|is your name grove|why (is|was) your name( grove)?|why grove|how did you get your name|where did your name come from|who named you|what does (your name|grove) mean)\b/), 0.9],

  ["ask_home", re(/\b(where do you live|where are you from|where is your home|where do you stay|where are you)\b/), 0.85],

  ["ask_food", re(/\b(what do you eat|are you hungry|do you eat|what do slimes eat|do you get hungry)\b/), 0.9],

  ["ask_sleep", re(/\b(do you (ever )?sleep|are you (tired|sleepy|awake|asleep)|when do you sleep|do you dream|do you (ever )?go to sleep|when do you go to sleep)\b/), 0.85],

  ["ask_like_me", re(/^(do|does) (you|grove) (like|love|hate|care about) me\b|\bam i your (friend|favorite|bestie|best friend)\b|\bare we (friends|besties)\b/), 0.9],

  ["ask_relationship", re(/\b(do you have a (girlfriend|boyfriend|crush|partner|wife|husband|lover|soulmate|valentine)|are you (single|married|taken|dating)|will you marry me|marry me|be my (girlfriend|boyfriend|valentine|partner|wife|husband)|date me|go out with me|wanna date)\b/), 0.9],

  ["ask_remember", re(/\b(do you (remember|know) (me|who i am|my name)|what is my name|who am i|do you know my name|remember me)\b/), 0.9],

  ["tell_name", re(/\b(my name is|call me|i am called|i go by|you can call me|my names) (?<name>[a-z][a-z0-9_]{1,19})\b/), 0.9],

  ["favorite_guess", any(
    re(/^(is|are) your (favorite|favourite) (?<thing>[a-z]+) (?<guess>[a-z0-9 ]{2,40})$/),
    re(/^(is|are) (the |a |an )?(?<guess>[a-z0-9 ]{2,40}?) your (favorite|favourite)( (?<thing>[a-z]+))?$/),
  ), 0.9],

  ["ask_favorite", any(
    re(/\b(what is|what are|which is) your (favorite|favourite) (?<thing>[a-z ]{2,30}?)$/),
    re(/\bdo you have a (favorite|favourite) (?<thing>[a-z ]{2,30}?)$/),
    re(/^your (favorite|favourite) (?<thing>[a-z ]{2,30}?)$/),
  ), 0.9],

  ["ask_have", all(noHelpTopic, any(
    re(/^(do|does) (you|grove) (have|got|own|keep|carry)( (a|an|any|some|your own|a lot of|lots of|many|much))? (?<thing>[a-z ]{2,30}?)$/),
    re(/^(have you got|you got)( (a|an|any|some))? (?<thing>[a-z ]{2,30}?)$|^got any (?<thing2>[a-z ]{2,30}?)$/),
    re(/^how many (?<thing>[a-z ]{2,24}?) (do you have|have you got|you got|does grove have)$/),
    re(/^what (is|do you have) in (your|grove s) (?<thing>pockets?|bag|backpack|inventory|hands?|mouth|tummy|belly|stomach)$/),
  )), 0.85],

  ["ask_now", any(
    re(/^what (time|day|date|year|month) is it( (right now|now|today|there|for you|where you are))?$/),
    re(/^what is the (time|date|day|year|month)( (right now|today|there|for you))?$/),
    re(/^what (day|date) is today$|^what is today$/),
    re(/^(what is|how is) (the )?weather( like)?( (today|right now|there|for you|where you are|outside))?$/),
    re(/^is it (raining|sunny|snowing|cold|hot|warm|cloudy|stormy|windy|night|day|morning|evening|afternoon|the weekend|a weekday)( (there|outside|where you are|for you|today|right now))?$/),
    re(/^do you know what (time|day) it is$|^what (time|day|date) it is$/),
  ), 0.85],

  ["origin_list", re(/\b(what|which) origins (are there|exist|can i (pick|choose|be)|are in|does it have|do you have)\b|\blist (of )?(the |all )?origins\b|\ball the origins\b|\bhow many origins\b/), 0.9],

  ["best_origin", re(/\b(best|strongest|coolest|favorite|favourite|worst|weakest|op|overpowered) origin\b|\bwhat origin should i (pick|choose|play|be)\b|\bwhich origin (is|should)\b/), 0.9],

  ["compliment", lineFeedback, 0.9],

  ["compliment", nameCalling, 0.85],

  ["love", any(
    re(/^(i )?(love|adore|luv) (you|grove)( (so|very) much| a lot| too| so)?$/),
    re(/^i love you\b/),
    re(/\bi (love|adore) you\b/),
    whole(/^(you are|your|youre|is) (my|our) (favorite|favourite|best friend|bestie|bff|everything|hero|sunshine|whole world|world)( (bot|slime|person|one|thing|friend|blob|ever|in the world|here))*$/),
  ), 0.95],

  ["aggression", any(
    re(/^(i am|i will|i shall|imma|ima|i might|i want to|i am about to|let me|i am finna|finna) (going to |gonna |about to |finna )?(?<action>eat|kill|squish|squash|kick|punch|hit|stomp|step on|throw|yeet|cook|fry|bake|freeze|salt|dry|pop|smack|slap|bite|stab|delete|ban|fight|beat up|sell|steal|kidnap|boil|microwave|feed) (you|grove)\b(?<rest>.*)$/),
    re(/^fight me\b|^1v1 me\b|^1 v 1 me\b|^square up\b|^catch these hands\b|^come at me\b|^bring it on\b|^wanna fight\b|^want to fight\b/),
  ), 0.85],

  ["hate", re(/\b(i )?(hate|despise|can not stand) (you|grove)\b|\bnobody likes you\b|\beveryone hates you\b|\bgo away\b|\bleave me alone\b|\bshut up\b|\bkill yourself\b|\bkys\b|\bfuck (you|off)\b|\bscrew you\b|\bpiss off\b|\bget lost\b|\bgo die\b/), 0.9],

  ["compliment", any(
    re(/\b(good|best|cute|smart|great|nice|cool|adorable|sweet|funny) (bot|slime|boy|girl|blob|grove)\b/),
    re(/^you (rock|rule|slay|ate|are the best|are amazing|are awesome)\b/),
    re(/\b(i like|i love) your (?<thing>[a-z ]{2,30})$/),
  ), 0.9],

  ["insult", any(
    re(/\b(bad|worst|dumb|stupid|useless|trash|terrible|annoying) (bot|slime|blob|grove)\b/),
    re(/^you (suck|stink|smell|reek|are the worst|are useless)\b/),
  ), 0.9],

  ["state_attribute", re(new RegExp(`^(?<subject>you are|your|you is|grove is|grove are|you have been|you been|youre) (?<neg>not |never )?${MODS}(?<word>[a-z]+)(?<tail>(?: [a-z]+){0,3})$`)), 0.85],

  ["ask_attribute", re(new RegExp(`^(?:are you|is grove|are u) (?<neg>not )?${MODS}(?<word>[a-z]+)(?<tail>(?: [a-z]+){0,4})$`)), 0.85],

  ["can_i_you", re(/^(can|could|may) i (?<verb>[a-z]+)( (on|with|at))? (you|grove)\b(?<rest>[a-z0-9 ]*)$/), 0.85],

  ["give", giving, 0.85],

  ["ask_ability", any(
    re(/^(can|could) you (?<verb>[a-z]+)(?<rest>(?: [a-z]+){0,6})$/),
    re(/^are you able to (?<verb>[a-z]+)(?<rest>(?: [a-z]+){0,6})$/),
    re(/^do you know how to (?<verb>[a-z]+)(?<rest>(?: [a-z]+){0,6})$/),
    doYou,
  ), 0.85],

  ["ask_like", any(
    re(/^do you (?<verb>like|love|enjoy|hate|dislike) (?<thing>[a-z ]{2,40}?)$/),
    re(/^(?<verb>what do you think) (about|of) (?<thing>[a-z ]{2,40}?)$/),
    re(/^(?<verb>how do you feel) about (?<thing>[a-z ]{2,40}?)$/),
    re(/^(your )?(?<verb>thoughts|opinion) on (?<thing>[a-z ]{2,40}?)$/),
  ), 0.85],

  ["hypothetical", re(/^(do you think (you will|you would|you can|you could|you might)|would you|will you|could you ever|if you were|if you could|what would you do if|have you ever|did you ever)\b(?<rest>.*)$/), 0.7],

  ["ask_name", re(/\b(?<old>cactus|cacti|cactuses)\b/), 0.85],

  ["thank", re(/\b(thank you|thanks|thank|appreciate (it|you|that)|much appreciated|cheers)\b/), 0.9],

  ["apologize", re(/\b(sorry|my bad|i apologize|apologies|forgive me|i did not mean (it|that|to))\b/), 0.9],

  ["joke", re(/\b(tell|say|know) (me |us )?(a |an |another |any |some )?(good |funny |bad )?(joke|jokes|pun|puns)\b|\bmake me laugh\b|\bjoke please\b/), 0.95],

  ["fact", re(/\b(tell|give|say) (me |us )?(a |an |another |some )?(fun |cool |random |interesting )?(orange |slime |minecraft |moss |frog )?facts?\b|\bfun fact please\b|\borange facts?\b/), 0.95],

  ["coin", re(/\b(flip|toss) (a |the )?coin\b|\bcoin ?flip\b|\bheads or tails\b/), 0.95],

  ["dice", re(/\broll (a |an |the |me a |me |us |some |my )?((?<count>\d{1,2}) ?)?(d(?<sides>\d{1,3})|die|dice|(?<sides2>\d{1,3}) sided( die| dice)?)\b|\broll (a d20 )?(with )?(?<mode>advantage|disadvantage)\b|\broll (me |my |some |for |up )?(?<stats>stats|ability scores|a character)\b/), 0.95],

  ["choose", re(/\b(pick|choose|should i (pick|choose|get|play|do|use|be)|which (one|is better|should i)|what should i (pick|choose|play|be))\b(?<options>.* or .*)$/), 0.85],

  ["rate", re(/^rate (my |this |the |our )?(?<thing>[a-z ]{2,40})$/), 0.85],

  ["perform", re(/^(sing|dance|rap|do a (dance|flip|trick|backflip)|sing (me |us )?(a song|something)|do a little dance|wiggle|bounce)\b/), 0.9],

  ["command", all(noHelpTopic, re(COMMAND)), 0.75],

  ["suggestion", re(/\b(suggestion|suggestions|i have an? idea|got an? idea|you should add|can you add|could you add|please add|would be (cool|nice|awesome) if|feature request|i suggest|idea for (an? )?(origin|power|feature)|new origin idea|where (do|can|should) i suggest)\b/), 0.85],

  ["jam_submit", all(hasTopic("jam"), re(/\b(submit|submitting|submission|submissions|entry|entries|enter|upload|post|turn in|hand in)\b/)), 0.9],

  ["jam_chat", all(hasTopic("jam"), re(/\b(talk|chat|discuss|discussion|conversation|hang out)\b/)), 0.9],

  ["jam_info", all(hasTopic("jam"), any(re(/\b(when|what|how|rules|theme|info|information|start|starts|end|ends|next|deadline|join|is there|are there|prize|prizes|win|winner|does)\b/), (_c, _t, reading) => (reading.question ? {} : null))), 0.85],

  ["media", all(hasTopic("media"), re(/\b(where|post|share|show|showcase|upload|put|drop)\b/)), 0.85],

  ["download", any(
    re(/\b(where|how) (can|do|to) (i |you )?(get|find|download|grab) (the )?(mod|mods|origins|apoli|it)\b/),
    re(/\b(download|downloads|download link|modrinth|curseforge)\b/),
    re(/\blink (to|for) (the )?(mod|mods|origins|apoli)\b/),
  ), 0.85],

  ["install", re(/\bhow (do|can|to|would) (i |you )?(install|add|put|set ?up|use) (origins|apoli|the mod|the mods|mods|it|this mod)\b|\binstall (origins|apoli|the mod)\b/), 0.85],

  ["compat", all(hasTopic("apoli", "origins", "origin"), re(/\b(compatible|compat|compatibility|work with|works with|work alongside|conflict|conflicts|incompatible|play nice with|run with)\b/)), 0.85],

  ["versions", all(hasTopic("versions"), any(re(/\b(is|does|will|can|are|do) (it|origins|apoli|this|the mod|the mods|they|you)\b/), re(/\b(what|which) (version|versions|loader|loaders|mc version|minecraft version)\b/), re(/\b(on|for|support|supports|port|available)\b/))), 0.85],

  ["server_info", re(/\b(what is this server|what server is this|what is this place|what is overgrown origins|what is overgrowns origins|what is this discord)\b/), 0.9],

  ["channels", re(/\b(what|which) channels?\b|\bchannel list\b|\blist of channels\b|\bwhere (do|can|should) i (get|find|ask for) help\b|\bwhere is (the )?(help|support)( channel)?\b|\bwhere do i go for help\b/), 0.85],

  ["how_to", re(/\bhow (do|can|would|should|to|does one|does someone) (i |we |you |one |someone )?(?<task>[a-z ].+)$/), 0.75],

  ["where_to", re(/\bwhere (do|can|should|would|could|to|does|is) (i |we |you |someone |people |one )?(?<task>[a-z ].+)$/), 0.75],

  ["define", any(
    re(/^(what|who) (is|are|was|were) (?<term>[a-z0-9 ]{2,40}?)$/),
    re(/^what does (?<term>[a-z0-9 ]{2,40}?) (do|mean|stand for)$/),
    re(/^(tell me about|explain|whats|talk about) (?<term>[a-z0-9 ]{2,40}?)$/),
    re(/^(what|who) (?<term>[a-z0-9 ]{2,40}?) (is|are)$/),
  ), 0.75],

  ["problem", all(hasTopic("problem"), (core, _t, reading) => (QUESTIONISH.test(core) || reading.tokens.length >= 3 ? {} : null)), 0.8],

  ["frog_alert", re(/\b(frog|frogs|froggy|froggie|froggies|toad|toads|ribbit|tadpole|tadpoles)\b/), 0.85],

  ["ask_feeling", re(/^(are|r) you (?<feeling>happy|sad|okay|ok|fine|mad|angry|upset|tired|sleepy|bored|lonely|hungry|scared|alright|good)$/), 0.9],

  ["share_feeling", re(/^(i am|i feel|im|feeling|i am feeling|i have been|i been) (so |really |very |kind of |pretty |super |a bit |a little |kinda )*(?<feeling>[a-z]+)( today| rn| right now| lately)?$/), 0.8],

  ["farewell", any(
    re(/\b(bye|goodbye|good night|night night|see you|talk to you later|got to go|i have to go|i am off|i am leaving|signing off|peace out|later|catch you later|i am going to bed|going to sleep|heading out|bye bye)\b/),
  ), 0.85],

  ["agree", re(/^(yes|true|exactly|correct|right|for real|facts|real|agreed|indeed|definitely|absolutely|same|me too|of course|sure|yes yes|totally|100|fair)$/), 0.8],

  ["disagree", re(/^(no|not really|wrong|false|i do not think so|disagree|never|no way|nah|not at all|cap)$/), 0.8],

  ["ack", re(/^(ok|cool|nice|alright|got it|i see|oh|ah|neat|bet|fair enough|makes sense|interesting|wow|oh ok|oh nice|nice nice|ok cool|cool cool|sounds good|good to know|noted|understood|word|oki|okay)$/), 0.75],
];

const ATTRIBUTE_NOUNS = new Set(["slime", "cactus", "plant", "frog", "blob", "jelly", "jello", "creature", "animal", "monster", "mob", "goo", "puddle", "rock", "tree", "moss"]);

// "are you better than carl-bot?": comparisons that praise, jab, or ask about size.
const BETTER = new Set(["better", "cooler", "cuter", "smarter", "nicer", "funnier", "prettier", "sweeter", "stronger", "faster", "bouncier", "squishier"]);
const WORSE = new Set(["worse", "dumber", "stupider", "uglier", "weaker", "slower", "lamer"]);
const BIGGER = new Set(["bigger", "smaller", "taller", "shorter", "heavier", "lighter", "tinier", "larger"]);

// Turns the generic "you are X" / "are you X" frames into the specific intent
// the word asks for: "are you a girl" is a gender question, "are you dumb" is
// a jab, "you are funny" is a compliment.
function specialize(id: IntentId, slots: Slots): { id: IntentId; slots: Slots } {
  if (id === "compliment" && slots["kind"] === "jab") return { id: "insult", slots };
  if (id !== "state_attribute" && id !== "ask_attribute") return { id, slots };

  const word = slots["word"] ?? "";
  const negated = (slots["neg"] ?? "").trim().length > 0;
  const asking = id === "ask_attribute";

  const than = /^than (?<other>.+)$/.exec((slots["tail"] ?? "").trim())?.groups?.["other"];
  if (than !== undefined) {
    if (BIGGER.has(word)) return { id: "ask_size", slots: { ...slots, size: word } };
    if (BETTER.has(word) || WORSE.has(word)) {
      if (asking) return { id: "ask_attribute", slots: { ...slots, kind: "compare", than } };
      return { id: BETTER.has(word) !== negated ? "compliment" : "insult", slots: { ...slots, than } };
    }
  }
  if (AGE_WORDS.has(word)) return { id: "ask_age", slots };

  if (GENDER_WORDS.has(word)) return { id: asking ? "ask_gender" : "claim_about_grove", slots: { ...slots, kind: "gender" } };
  if (BOT_WORDS.has(word)) return { id: asking ? "ask_is_bot" : "claim_about_grove", slots: { ...slots, kind: "bot" } };
  if (ALIVE_WORDS.has(word)) return { id: asking ? "ask_alive" : "claim_about_grove", slots: { ...slots, kind: "alive" } };
  if (ATTRIBUTE_NOUNS.has(word)) return { id: asking ? "ask_species" : "claim_about_grove", slots: { ...slots, kind: "species", thing: word } };
  if (SIZE_WORDS.has(word)) return { id: "ask_size", slots: { ...slots, size: word } };
  if (asking && FEELINGS[word] !== undefined && !INSULTS.has(word) && !COMPLIMENTS.has(word)) return { id: "ask_feeling", slots: { ...slots, feeling: word } };

  const insulting = INSULTS.has(word);
  const praising = COMPLIMENTS.has(word);
  if (insulting || praising) {
    const kind = insulting !== negated ? "insult" : "compliment";
    if (asking) return { id: kind === "insult" ? "ask_insult" : "ask_compliment", slots };
    return { id: kind, slots };
  }

  return { id: asking ? "ask_attribute" : "claim_about_grove", slots: { ...slots, kind: "other" } };
}

// Generic readings that a slang word explains better: "are you mewing" is not
// a question about some attribute, "can you hit the griddy" not a question
// about hitting, "do you have rizz" not about Grove's belongings.
const SLANG_CAN_REPLACE = new Set<IntentId>([
  "state_attribute", "ask_attribute", "claim_about_grove", "ask_ability", "command", "question", "statement", "define",
  "ask_like", "how_to", "hypothetical", "ask_have", "can_i_you", "give", "share_feeling", "ask_feeling",
]);

// How the slang word was used: asked about Grove, asked of Grove, said about
// Grove, said about themselves, asked what it means, or just said.
function slangUse(core: string, from: IntentId, term: SlangTerm): SlangUse {
  if (term.tone === "rude") return "say";
  const aboutGrove = /\b(you|your|grove|yours)\b/.test(core);
  if (/\b(mean|means|meaning|stand for|stands for|definition)\b/.test(core) || /^(explain|define|teach me)\b/.test(core)) return "define";
  if ((from === "define" || from === "how_to" || /^what (is|are) (a |an |the )?[a-z ]+$/.test(core)) && !aboutGrove) return "define";
  if (from === "ask_ability" || from === "command" || from === "can_i_you") return term.perform !== undefined ? "perform" : "ask";
  if (/^(can|could|will|would|please)\b/.test(core) && /\b(for me|for us|right now|please)\b/.test(core) && term.perform !== undefined) return "perform";
  if (/^(are|is|do|does|did|can|could|will|would|have|has|should|were|was|how|who|what|which|got)\b/.test(core) && aboutGrove) return "ask";
  if (/^(you|your|grove|yours)\b/.test(core)) return "you";
  if (/^(i|we|my|me|us)\b/.test(core)) return "me";
  const words = core.split(" ");
  if (/^(hit|do|show|give|let|try)\b/.test(core) || (words.length > 1 && term.match.test(words[0]!))) return "perform";
  return "say";
}

export function interpret(reading: Reading, topics: Topics): { intents: Intent[]; greeted: boolean } {
  const intents: Intent[] = [];
  let greeted = false;

  const frogEmoji = reading.emojis.includes("🐸");
  if (reading.tokens.length === 0) {
    if (frogEmoji) intents.push({ id: "frog_alert", confidence: 0.85, slots: {}, clause: 0 });
    else if (reading.question) intents.push({ id: "confused", confidence: 0.8, slots: {}, clause: 0 });
    else if (reading.laugh) intents.push({ id: "laugh", confidence: 0.9, slots: {}, clause: 0 });
    else if (reading.emojis.some(e => e === "heart" || e === "❤️" || e === "❤" || e === "grove_heart" || e === "🥰" || e === "😍")) {
      intents.push({ id: "love", confidence: 0.6, slots: {}, clause: 0 });
    }
    return { intents, greeted };
  }

  const problem = mathIn(reading.raw);
  if (problem !== null) {
    intents.push({ id: "math", confidence: 0.95, slots: { expression: problem.expression, variable: problem.variable }, clause: 0 });
    return { intents, greeted };
  }

  reading.clauses.forEach((clause, index) => {
    const { core, tokens, greeted: clauseGreeted } = coreOf(clause, clause.question || reading.question);
    if (clauseGreeted) greeted = true;

    if (GREETING_ONLY.test(clause.text)) {
      greeted = true;
      intents.push({ id: "greet", confidence: 0.9, slots: {}, clause: index });
      return;
    }
    if (clause.tokens.every(token => LAUGH_WORDS.has(token) || token === "grove")) {
      intents.push({ id: "laugh", confidence: 0.9, slots: {}, clause: index });
      return;
    }

    const slang = slangIn(core);
    const slangIntent = (from: IntentId): Intent => ({
      id: "slang",
      confidence: 0.8,
      slots: { term: slang!.id, use: slangUse(core, from, slang!), tone: slang!.tone ?? "" },
      clause: index,
    });

    let matched = false;
    for (const [id, test, confidence] of FRAMES) {
      const slots = test(core, tokens, reading, topics, clause);
      if (slots === null) continue;
      const specialized = specialize(id, slots);
      // "you're mid" stays an insult: being called a jab still stings.
      const stings = slang?.tone === "jab" && (specialized.id === "insult" || specialized.id === "ask_insult");
      // "ur goated", "based grove": praise said in slang gets the slang answer.
      const slangPraise = specialized.id === "compliment" && slang?.tone === "praise" && slang.match.test(specialized.slots["word"] ?? "");
      const replaceable = SLANG_CAN_REPLACE.has(id) || SLANG_CAN_REPLACE.has(specialized.id) || slangPraise;
      if (slang !== null && replaceable && !stings && !/\bwould you rather\b/.test(core)) intents.push(slangIntent(specialized.id));
      else intents.push({ id: specialized.id, confidence, slots: specialized.slots, clause: index });
      matched = true;
      if (specialized.id !== "thank" && specialized.id !== "farewell") break;
    }

    if (!matched) {
      if (slang !== null) {
        intents.push(slangIntent(clause.question ? "question" : "statement"));
      } else if (clause.question || /\?/.test(reading.raw)) {
        intents.push({ id: "question", confidence: 0.4, slots: { text: core }, clause: index });
      } else {
        intents.push({ id: "statement", confidence: 0.3, slots: { text: core }, clause: index });
      }
    }
  });

  if (frogEmoji && !intents.some(intent => intent.id === "frog_alert")) {
    intents.push({ id: "frog_alert", confidence: 0.8, slots: {}, clause: 0 });
  }

  if (reading.action !== null) {
    const action = reading.action;
    if (/\b(kick|kicks|punch|punches|hit|hits|slap|slaps|stomp|stomps|step on|steps on|eat|eats|bite|bites|throw|throws|yeet|yeets|smack|smacks|squash|squashes|stab|stabs|salts|salt)\b/.test(action)) {
      intents.unshift({ id: "aggression", confidence: 0.9, slots: { action }, clause: 0 });
    } else if (/\b(pet|pets|pat|pats|patting|petting|hug|hugs|hugging|boop|boops|cuddle|cuddles|kiss|kisses|squish|squishes|snuggle|snuggles|holds|hold|scritch|scritches|headpat|headpats|feeds|feed|gives|give|poke|pokes|tickle|tickles|pocket|pockets|picks up|pick up|carries|carry|scoops|scoop|adopts|adopt|kidnaps|kidnap|steals|steal|yoinks|yoink|takes|waves|wave|shares|offers)\b/.test(action)) {
      intents.unshift({ id: "affection", confidence: 0.9, slots: { action }, clause: 0 });
    }
  }

  return { intents, greeted };
}

// Some intents matter more than others when one message carries several:
// "hi grove! where do I report bugs?" is a question with a greeting attached.
const WEIGHT: Partial<Record<IntentId, number>> = {
  distress: 100,
  problem: 60, suggestion: 60, media: 60, jam_info: 60, jam_submit: 62, jam_chat: 61, contact_staff: 60,
  download: 58, versions: 58, install: 58, compat: 58, help: 55, how_to: 54, where_to: 54, define: 52, commands: 52,
  origin_list: 52, best_origin: 50, server_info: 50,
  confused: 57, why: 56, channels: 55, bomb: 59, follow_up: 56, more: 55, doubt: 50, favorite_person: 44,
  politics: 59, homework: 56, fantasy: 51, dumb_question: 50, fan: 48,
  where_am_i: 50, ask_origin_story: 45, ask_body: 44, ask_size: 43, can_i_you: 42, favorite_guess: 43, hypothetical: 36,
  ask_crew: 44, ask_fear: 43, ask_have: 42, ask_now: 42, self_how: 42, give: 41, frog_alert: 41, command: 36,
  hate: 50, insult: 48, love: 47, compliment: 46, ask_insult: 45, ask_compliment: 45,
  ask_gender: 44, ask_is_bot: 44, ask_alive: 44, ask_identity: 44, ask_creator: 44, ask_age: 44,
  ask_name: 43, ask_species: 43, ask_home: 42, ask_food: 42, ask_sleep: 42, ask_relationship: 43,
  ask_like_me: 43, ask_remember: 43, tell_name: 43, ask_favorite: 42, ask_like: 42, ask_ability: 42,
  ask_attribute: 40, claim_about_grove: 40, ask_feeling: 41, ask_thinking: 41,
  how_is_day: 41, how_are_you: 40, what_doing: 40, share_feeling: 38,
  joke: 39, fact: 39, coin: 39, dice: 39, choose: 39, math: 39, rate: 38, perform: 38,
  affection: 37, aggression: 37, slang: 30,
  apologize: 35, thank: 33, farewell: 32, greet: 20, laugh: 25, agree: 22, disagree: 22, ack: 15,
  question: 18, statement: 10,
};

export function weightOf(id: IntentId): number {
  return WEIGHT[id] ?? 10;
}
