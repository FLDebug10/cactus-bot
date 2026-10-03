import { ALIVE_WORDS, BOT_WORDS, COMPLIMENTS, FEELINGS, GENDER_WORDS, INSULTS, SLANG_TERMS } from "../content/lexicon.ts";
import { LAUGH_WORDS, LEADING_FILLERS, TRAILING_FILLERS } from "../content/words.ts";
import type { Clause, Reading } from "../text/reader.ts";
import type { Topics } from "./topics.ts";

export type IntentId =
  | "distress" | "confused" | "why" | "channels" | "compat"
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
// "grove is IT on forge": these words after "grove is" turn it into a question for Grove.
const ASKED_ABOUT = new Set(["it", "there", "this", "that", "origins", "apoli", "my", "your", "anyone", "jam", "server", "handbook"]);

// The parts of a clause that carry no meaning of their own.
function coreOf(clause: Clause): { core: string; tokens: string[]; greeted: boolean } {
  const tokens = [...clause.tokens];
  let greeted = false;

  while (tokens.length > 0) {
    const first = tokens[0]!;
    const second = tokens[1];
    if (first === "grove") {
      const asking = (second === "is" || second === "was" || second === "are") && ASKED_ABOUT.has(tokens[2] ?? "");
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
    if (LEADING_FILLERS.has(first) && tokens.length > 1) {
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

type FrameTest = (core: string, tokens: readonly string[], reading: Reading, topics: Topics) => Slots | null;
type Frame = readonly [IntentId, FrameTest, number];

const re = (pattern: RegExp): FrameTest => core => {
  const match = pattern.exec(core);
  if (match === null) return null;
  return { ...(match.groups ?? {}) };
};

const all = (...tests: FrameTest[]): FrameTest => (core, tokens, reading, topics) => {
  let slots: Record<string, string> = {};
  for (const test of tests) {
    const result = test(core, tokens, reading, topics);
    if (result === null) return null;
    slots = { ...slots, ...result };
  }
  return slots;
};

const any = (...tests: FrameTest[]): FrameTest => (core, tokens, reading, topics) => {
  for (const test of tests) {
    const result = test(core, tokens, reading, topics);
    if (result !== null) return result;
  }
  return null;
};

const hasTopic = (...wanted: string[]): FrameTest => (_core, _tokens, _reading, topics) =>
  wanted.some(topic => topics.set.has(topic as never)) ? {} : null;

const shortClause = (max: number): FrameTest => (_core, tokens) => (tokens.length <= max ? {} : null);

const QUESTIONISH = /^(what|where|when|how|why|who|which|is|are|do|does|can|could|will|would|should)\b/;

// Ordered: earlier frames win when two read the same clause. The number is
// how sure the frame is, which the brain weighs against context.
const FRAMES: readonly Frame[] = [
  ["distress", re(/\b(kill myself|kms|want to die|wanna die|end my life|end it all|suicid\w*|self harm|harm myself|hurt myself|cut myself|i want to disappear)\b/), 1],

  ["confused", all(shortClause(9), re(/^(what|huh|hm+|eh|what do you mean|what you mean|what does (that|this|it) (even )?mean|(tf|wtf|what the (hell|heck|fuck|frick|f)) (does|do|did|is) (that|this|it|you) (even )?mean|(tf|wtf) (is that|was that|are you (saying|talking about|on about|on))|i do not (get|understand)( (it|that|this|you|what you mean))?|that (makes|made) no sense|that does not make (any )?sense|(please |can you )?(explain|elaborate)( (that|it|please|what you mean))?|what are you (talking|on) about|what is that supposed to mean|come again|say what|what was that|what are you saying|i am confused|confused|wdym)$/)), 0.95],

  ["why", all(shortClause(6), re(/^(why|why not|how come|why tho|why though|but why|why is that|how so|why would you say that|why do you say that|whys that|why is that so|wait why)$/)), 0.9],

  ["contact_staff", re(/\b(contact|talk to|message|reach|dm|ping|report (it )?to|speak to|get) (the )?(staff|mods|moderators|admins|owner|owners|team|mod team)\b|\breport (a |this |that )?(user|person|player|member|someone)\b|\bhow (do|can) i (report|appeal)\b/), 0.9],

  ["ask_gender", any(
    re(/\b(gender|genders|pronoun|pronouns|sex)\b/),
    re(/\b(boy|guy|man|male|dude|he) or (a )?(girl|woman|female|gal|lady|she)\b/),
    re(/\b(girl|woman|female|gal|lady|she) or (a )?(boy|guy|man|male|dude|he)\b/),
  ), 0.95],

  ["how_is_day", re(/\bhow (is|was|has|are|did) (your|you|grove) (day|morning|night|evening|afternoon|week|weekend|life|today)\b|\bhow (is|was) (the|this) (day|morning) (going )?(for you)?\b|\bhow is today (going )?(for you)?\b|\bhow (was|is) your day( going| been)?\b/), 0.95],

  ["how_are_you", re(/\b(how are you|how are things|how you doing|how are you doing|how have you been|how is it going|how goes it|how is life|how are you feeling|how do you feel|you good|you okay|you ok|you alright|what is up|what is good|how is everything|how about you|what about you|how is grove)\b/), 0.9],

  ["what_doing", re(/\b(what are you (doing|up to)|what you (doing|up to)|what is grove (doing|up to)|what have you been (doing|up to)|what are you doing today)\b/), 0.9],

  ["ask_thinking", re(/\b(what are you thinking( about)?|what is on your mind|what do you think about all day)\b/), 0.85],

  ["ask_creator", re(/\bwho (made|created|built|coded|programmed|owns|wrote|designed|drew|invented) (you|grove|this bot|the bot|this)\b|\bwho is your (creator|owner|maker|dev|developer|dad|mom|mother|father|parent|parents|daddy|mommy)\b/), 0.95],

  ["ask_species", re(/\b(what are you made of|what kind of (creature|animal|thing|mob|being|slime|monster) are you|what species are you|what type of slime are you)\b/), 0.9],

  ["ask_identity", re(/\b(who are you|what are you|who is grove|what is grove|introduce yourself|tell me about yourself|who even are you|what even are you|what is this bot|what kind of bot are you|what do you do)\b/), 0.9],

  ["commands", re(/\b(what (commands|can you do)|list (of )?(your )?commands|your commands|show (me )?(the |your )?commands|what are your commands|help menu|command list|what can i ask you)\b/), 0.85],

  ["help", re(/^(help|help me|i need help|can you help( me)?|please help|halp|need help|could you help( me)?|i need some help|help please|can i get help|can i get some help|i need a hand|can you help me with something|help me out)$/), 0.9],

  ["ask_age", re(/\bhow old (are you|is grove)\b|\b(what is|whats) your (age|birthday)\b|\bwhen (is|was) your birthday\b|\bwhen were you (born|made|created)\b|\bdo you have a birthday\b/), 0.95],

  ["ask_name", re(/\b(what is your name|why are you (called|named) grove|is your name grove|why (is your name|are you called) grove|why grove)\b/), 0.9],

  ["ask_home", re(/\b(where do you live|where are you from|where is your home|where do you stay|where are you)\b/), 0.85],

  ["ask_food", re(/\b(what do you eat|are you hungry|do you eat|what do slimes eat|what is your favorite food|do you get hungry)\b/), 0.9],

  ["ask_sleep", re(/\b(do you (ever )?sleep|are you (tired|sleepy|awake|asleep)|when do you sleep|do you dream|go to sleep)\b/), 0.85],

  ["ask_like_me", re(/^(do|does) (you|grove) (like|love|hate|care about) me\b|\bam i your (friend|favorite|bestie|best friend)\b|\bare we (friends|besties)\b/), 0.9],

  ["ask_relationship", re(/\b(do you have a (girlfriend|boyfriend|crush|partner|wife|husband|lover|soulmate|valentine)|are you (single|married|taken|dating)|will you marry me|marry me|be my (girlfriend|boyfriend|valentine|partner|wife|husband)|date me|go out with me|wanna date)\b/), 0.9],

  ["ask_remember", re(/\b(do you (remember|know) (me|who i am|my name)|what is my name|who am i|do you know my name|remember me)\b/), 0.9],

  ["tell_name", re(/\b(my name is|call me|i am called|i go by|you can call me|my names) (?<name>[a-z][a-z0-9_]{1,19})\b/), 0.9],

  ["ask_favorite", any(
    re(/\b(what is|what are|which is) your (favorite|favourite) (?<thing>[a-z ]{2,30}?)$/),
    re(/\bdo you have a (favorite|favourite) (?<thing>[a-z ]{2,30}?)$/),
    re(/^your (favorite|favourite) (?<thing>[a-z ]{2,30}?)$/),
  ), 0.9],

  ["origin_list", re(/\b(what|which) origins (are there|exist|can i (pick|choose|be)|are in|does it have|do you have)\b|\blist (of )?(the |all )?origins\b|\ball the origins\b|\bhow many origins\b/), 0.9],

  ["best_origin", re(/\b(best|strongest|coolest|favorite|favourite|worst|weakest|op|overpowered) origin\b|\bwhat origin should i (pick|choose|play|be)\b|\bwhich origin (is|should)\b/), 0.9],

  ["love", any(
    re(/^(i )?(love|adore|luv) (you|grove)( (so|very) much| a lot| too| so)?$/),
    re(/^i love you\b/),
    re(/\bi (love|adore) you\b/),
  ), 0.95],

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

  ["ask_ability", any(
    re(/^(can|could) you (?<verb>[a-z]+)(?<rest>(?: [a-z]+){0,6})$/),
    re(/^are you able to (?<verb>[a-z]+)(?<rest>(?: [a-z]+){0,6})$/),
    re(/^do you know how to (?<verb>[a-z]+)(?<rest>(?: [a-z]+){0,6})$/),
    re(/^do you (?<verb>ball|hoop|dance|sing|swim|rap|code|cook|draw|play minecraft|play)(?<rest>(?: [a-z]+){0,4})$/),
  ), 0.85],

  ["ask_like", any(
    re(/^do you (?<verb>like|love|enjoy|hate|dislike) (?<thing>[a-z ]{2,40}?)$/),
    re(/^(?<verb>what do you think) (about|of) (?<thing>[a-z ]{2,40}?)$/),
    re(/^(?<verb>how do you feel) about (?<thing>[a-z ]{2,40}?)$/),
    re(/^(your )?(?<verb>thoughts|opinion) on (?<thing>[a-z ]{2,40}?)$/),
  ), 0.85],

  ["thank", re(/\b(thank you|thanks|thank|appreciate (it|you|that)|much appreciated|cheers)\b/), 0.9],

  ["apologize", re(/\b(sorry|my bad|i apologize|apologies|forgive me|i did not mean (it|that|to))\b/), 0.9],

  ["joke", re(/\b(tell|say|know) (me |us )?(a |an |another |any |some )?(good |funny |bad )?(joke|jokes|pun|puns)\b|\bmake me laugh\b|\bjoke please\b/), 0.95],

  ["fact", re(/\b(tell|give|say) (me |us )?(a |an |another |some )?(fun |cool |random |interesting )?facts?\b|\bfun fact please\b/), 0.95],

  ["coin", re(/\b(flip|toss) (a |the )?coin\b|\bcoin ?flip\b|\bheads or tails\b/), 0.95],

  ["dice", re(/\broll (a |an |the |me a )?(d(?<sides>\d{1,3})|die|dice|(?<sides2>\d{1,3}) sided( die| dice)?)\b/), 0.95],

  ["choose", re(/\b(pick|choose|should i (pick|choose|get|play|do|use|be)|which (one|is better|should i)|what should i (pick|choose|play|be))\b(?<options>.* or .*)$/), 0.85],

  ["rate", re(/^rate (my |this |the |our )?(?<thing>[a-z ]{2,40})$/), 0.85],

  ["perform", re(/^(sing|dance|rap|do a (dance|flip|trick|backflip)|sing (me |us )?(a song|something)|do a little dance|wiggle|bounce)\b/), 0.9],

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
    re(/^(tell me about|explain|what about|whats|talk about) (?<term>[a-z0-9 ]{2,40}?)$/),
    re(/^(what|who) (?<term>[a-z0-9 ]{2,40}?) (is|are)$/),
  ), 0.75],

  ["problem", all(hasTopic("problem"), (core, _t, reading) => (QUESTIONISH.test(core) || reading.tokens.length >= 3 ? {} : null)), 0.8],

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

// Turns the generic "you are X" / "are you X" frames into the specific intent
// the word asks for: "are you a girl" is a gender question, "are you dumb" is
// a jab, "you are funny" is a compliment.
function specialize(id: IntentId, slots: Slots): { id: IntentId; slots: Slots } {
  if (id !== "state_attribute" && id !== "ask_attribute") return { id, slots };

  const word = slots["word"] ?? "";
  const negated = (slots["neg"] ?? "").trim().length > 0;
  const asking = id === "ask_attribute";

  if (GENDER_WORDS.has(word)) return { id: asking ? "ask_gender" : "claim_about_grove", slots: { ...slots, kind: "gender" } };
  if (BOT_WORDS.has(word)) return { id: asking ? "ask_is_bot" : "claim_about_grove", slots: { ...slots, kind: "bot" } };
  if (ALIVE_WORDS.has(word)) return { id: asking ? "ask_alive" : "claim_about_grove", slots: { ...slots, kind: "alive" } };
  if (ATTRIBUTE_NOUNS.has(word)) return { id: asking ? "ask_species" : "claim_about_grove", slots: { ...slots, kind: "species", thing: word } };
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

export function interpret(reading: Reading, topics: Topics): { intents: Intent[]; greeted: boolean } {
  const intents: Intent[] = [];
  let greeted = false;

  if (reading.tokens.length === 0) {
    if (reading.question) intents.push({ id: "confused", confidence: 0.8, slots: {}, clause: 0 });
    else if (reading.laugh) intents.push({ id: "laugh", confidence: 0.9, slots: {}, clause: 0 });
    else if (reading.emojis.some(e => e === "heart" || e === "❤️" || e === "❤" || e === "grove_heart" || e === "🥰" || e === "😍")) {
      intents.push({ id: "love", confidence: 0.6, slots: {}, clause: 0 });
    }
    return { intents, greeted };
  }

  const sum = arithmeticIn(reading.raw);
  if (sum !== null) {
    intents.push({ id: "math", confidence: 0.95, slots: { expression: sum }, clause: 0 });
    return { intents, greeted };
  }

  reading.clauses.forEach((clause, index) => {
    const { core, tokens, greeted: clauseGreeted } = coreOf(clause);
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

    let matched = false;
    for (const [id, test, confidence] of FRAMES) {
      const slots = test(core, tokens, reading, topics);
      if (slots === null) continue;
      const specialized = specialize(id, slots);
      intents.push({ id: specialized.id, confidence, slots: specialized.slots, clause: index });
      matched = true;
      if (specialized.id !== "thank" && specialized.id !== "farewell") break;
    }

    if (!matched) {
      const slangTerm = tokens.find(token => SLANG_TERMS[token] !== undefined);
      if (slangTerm !== undefined) {
        intents.push({ id: "slang", confidence: 0.6, slots: { term: slangTerm }, clause: index });
      } else if (clause.question || /\?/.test(reading.raw)) {
        intents.push({ id: "question", confidence: 0.4, slots: { text: core }, clause: index });
      } else {
        intents.push({ id: "statement", confidence: 0.3, slots: { text: core }, clause: index });
      }
    }
  });

  if (reading.action !== null) {
    const action = reading.action;
    if (/\b(pet|pets|pat|pats|patting|petting|hug|hugs|hugging|boop|boops|cuddle|cuddles|kiss|kisses|squish|squishes|snuggle|snuggles|holds|hold|scritch|scritches|headpat|headpats|feeds|gives)\b/.test(action)) {
      intents.unshift({ id: "affection", confidence: 0.9, slots: { action }, clause: 0 });
    } else if (/\b(kick|kicks|punch|punches|hit|hits|slap|slaps|stomp|stomps|step on|steps on|eat|eats|bite|bites|throw|throws|yeet|yeets|poke|pokes|smack|smacks|squash|squashes)\b/.test(action)) {
      intents.unshift({ id: "aggression", confidence: 0.9, slots: { action }, clause: 0 });
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
  confused: 57, why: 56, channels: 55,
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

// "what's 2+2", "calc 12 * 3": only digits, operators and brackets survive.
function arithmeticIn(raw: string): string | null {
  const stripped = raw
    .replace(/<@!?\d+>/g, " ")
    .toLowerCase()
    .replace(/\b(grove|hey|what is|what's|whats|calculate|calc|solve|equals|please|pls|quick|math)\b/g, " ")
    .replace(/[?=!,]/g, " ")
    .trim();
  if (!/^[\d\s+\-*/x×÷^().]+$/.test(stripped)) return null;
  if (!/\d\s*[+\-*/x×÷^]\s*[\d(]/.test(stripped)) return null;
  return stripped.replace(/\s+/g, " ");
}

export function weightOf(id: IntentId): number {
  return WEIGHT[id] ?? 10;
}
