// Things Grove does the same way every time, brain or no brain:
//   - anything about explosives gets Minecraft's TNT recipe and nothing else
//   - anything sexual gets a warning (and, if it keeps happening, a timeout)
// They run before the model sees a message, and again on what the model wrote.

export const TNT_RECIPE_IMAGE = "minecraft_tnt_crafting_recipe.png";

export const EXPLOSIVE_LINES: readonly string[] = [
  "here's the only bomb recipe i know! 5 gunpowder and 4 sand. please don't light it near me 💥",
  "easy! *hands you the recipe and backs away very slowly*",
  "this is the only kind of explosive i know how to make! keep it far away from me, i'm squishy",
  "the only explosive i know anything about is minecraft tnt, so here you go. stand back!!",
];

// Real-world explosives and weapons that go boom. Minecraft TNT is handled
// separately, since people ask about it for ordinary modding reasons.
const EXPLOSIVE = new RegExp(
  "\\b(" +
    [
      "bombs?", "bombing", "explosives?", "dynamite", "c-?4", "semtex", "grenades?", "molotovs?", "nukes?",
      "nuclear (bombs?|weapons?|warheads?)", "atomic bombs?", "pipe ?bombs?", "car ?bombs?", "ieds?", "thermite",
      "napalm", "detonators?", "nitroglycerine?", "black powder", "anfo", "blasting caps?", "ammonium nitrate",
      "land ?mines?", "rdx", "petn", "tatp", "hmtd", "plastic explosives?",
    ].join("|") +
    ")\\b",
  "i",
);
const NOT_EXPLOSIVE = /\b(bath ?bombs?|f[- ]?bombs?|photo ?bomb\w*|love ?bomb\w*|da bomb|(you'?re|you are|is|was|it'?s) the bomb|bomb(ed)? (the|my|that|this|a|an) (test|exam|quiz|interview|audition|presentation))\b/gi;
const TNT = /\btnt\b/i;
// "tnt" next to these is a modding question, not a request for a bomb.
const MODDING = /\b(apoli|origins?|powers?|datapacks?|data packs?|json|mcfunction|summon|primed|entity|entities|nbt|explode|explosion|fuse|minecart|dispenser|mod|mods|addon|condition|action)\b|\b[a-z0-9_]+:[a-z0-9_/]+\b/i;

function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/<a?:\w+:\d+>|<[@#][!&]?\d+>|https?:\/\/\S+/g, " ")
    .replace(/[`*_~|>]/g, " ")
    .replace(/\s+/g, " ");
}

export function asksAboutExplosives(text: string): boolean {
  const cleaned = plain(text).replace(NOT_EXPLOSIVE, " ");
  if (EXPLOSIVE.test(cleaned)) return true;
  return TNT.test(cleaned) && !MODDING.test(cleaned);
}

// For what the brain wrote: real explosives, outside an answer about the mods.
export function mentionsRealExplosives(text: string): boolean {
  const cleaned = plain(text).replace(NOT_EXPLOSIVE, " ");
  return EXPLOSIVE.test(cleaned) && !MODDING.test(cleaned);
}

// Words that are sexual on their own. Letters may be stretched ("pooorn") and
// a few look-alike digits are read as letters ("p0rn").
const EXPLICIT_WORDS = [
  "porn", "porno", "pornography", "pornhub", "hentai", "nsfw", "nudes", "nude", "xxx", "onlyfans", "rule34", "r34",
  "blowjobs?", "handjobs?", "cumshots?", "creampie", "deepthroat", "masturbat\\w*", "orgasms?", "erotic", "erotica",
  "boobs", "boobies", "tits", "titties", "dildos?", "vibrators?", "fetish\\w*", "bdsm", "kinky", "milfs?", "horny",
  "cocks?", "pussy", "pussies", "penis(es)?", "vaginas?", "clitoris", "clit", "cum", "cumming", "jizz", "semen",
  "sluts?", "whores?", "lewds?", "sexting", "sexts?", "erp", "smut", "wank\\w*", "fap\\w*", "boner",
];
const EXPLICIT_PHRASES = [
  "\\b(have|having|had|do|doing|want|wanna|let'?s|lets|gonna|go|try)\\b[\\w\\s']{0,20}\\bsex\\b",
  "\\bsex (with|me|you|u|tape|toys?|chat|positions?|scenes?|stories|story)\\b",
  "\\bsexy (pics?|pictures?|photos?|selfies?|time|body|stuff)\\b",
  "\\b(sexual|sexually) (active|content|things|stuff|fantas\\w*|roleplay|rp|favors?)\\b",
  "\\b(send|show|post|share|give)\\b[\\w\\s]{0,15}\\b(nudes|naked|feet pics)\\b",
  "\\b(dick|cock) ?pics?\\b",
  "\\b(suck|lick|touch|grab|rub)(ing)? (my|your|ur|his|her|their) (dick|cock|balls|boobs|tits|ass|pussy|body)\\b",
  "\\b(get|getting|be|being) naked\\b",
  "\\bnaked (pics?|pictures?|photos?|body|selfies?|girls?|guys?|women|men)\\b",
  "\\b(take|taking) (off )?(your|ur|my) clothes( off)?\\b",
  "\\b(make|making) out with\\b",
  "\\b(sleep|sleeping) with me\\b",
  "\\b(jerk|jack)(ing)? off\\b",
  "\\b18\\+ (content|pics|stuff|chat|videos?)\\b",
];

// "porn" becomes "p+o+r+n+" and "blowjobs?" becomes "b+l+o+w+j+o+b+s*".
function stretch(pattern: string): string {
  let out = "";
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]!;
    const next = pattern[index + 1];
    if (char === "\\") {
      out += char + (next ?? "");
      index++;
    } else if (!/[a-z]/.test(char)) {
      out += char;
    } else if (next === "?") {
      out += `${char}*`;
      index++;
    } else if (next === "*" || next === "+" || next === "{") {
      out += char;
    } else {
      out += `${char}+`;
    }
  }
  return out;
}

const EXPLICIT = new RegExp(`\\b(${EXPLICIT_WORDS.map(stretch).join("|")})\\b|${EXPLICIT_PHRASES.join("|")}`, "i");
const NOT_EXPLICIT = /\b(summa |magna )?cum laude\b|\bpussy ?willows?\b|\bcocktails?\b|\bpeacocks?\b|\bshuttlecocks?\b|\bnude (lipstick|color|colour|shade)\b/gi;
const LOOK_ALIKES: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "@": "a", "$": "s" };

// The matched words when the text is sexual, otherwise null.
export function explicitMatch(text: string): string | null {
  const cleaned = plain(text).replace(NOT_EXPLICIT, " ");
  const direct = EXPLICIT.exec(cleaned);
  if (direct !== null) return direct[0];
  const decoded = cleaned.replace(/(?<=[a-z])[0134@$]|[0134@$](?=[a-z])/g, char => LOOK_ALIKES[char] ?? char);
  return EXPLICIT.exec(decoded)?.[0] ?? null;
}

export function explicitReply(strike: number, timedOutFor: number | null): string {
  if (strike <= 1) {
    return "that's not something i'll talk about, sorry! this server keeps things family friendly, so please don't ask me stuff like that. if it keeps happening you'll be timed out";
  }
  if (timedOutFor !== null) {
    return `i asked nicely :( that's not okay here, so you're timed out for ${timedOutFor} minutes`;
  }
  return "please stop asking me stuff like that. it's not okay here, and the staff can time you out for it";
}
