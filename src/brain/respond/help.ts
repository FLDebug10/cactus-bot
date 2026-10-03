import { LINKS } from "../../config.ts";
import { downloadLine, MOD_FACTS, ORIGIN_BY_ID, ORIGINS, SERVER_FACTS } from "../content/knowledge.ts";
import { SLANG_TERMS } from "../content/lexicon.ts";
import { KNOWN_WORDS } from "../content/words.ts";
import type { IntentId } from "../understand/intents.ts";
import { findTopics, type Topics } from "../understand/topics.ts";
import { channel, EMOJI, type Reply, type Responder, type Turn, safeWord } from "./turn.ts";

// Pointing people at the right place, and answering questions about the mods.

type Place = "bug" | "datapack" | "addon" | "unsure";

// Where a problem belongs. Their own pack or addon goes to the support
// channels; the mods misbehaving on their own is a bug report.
function placeFor(topics: Topics): Place {
  const has = (topic: string) => topics.set.has(topic as never);
  if (topics.owner === "own") return has("addon") ? "addon" : "datapack";
  if (topics.owner === "mod") return "bug";
  if (has("addon")) return "addon";
  if (has("datapack") || has("json") || has("resourcepack")) return "datapack";
  if (has("apoli") || has("origins") || topics.originId !== null) return "bug";
  return "unsure";
}

// `asked` is a "where do I report bugs?" question rather than a description of
// a problem, so the answer is directions, not a diagnosis.
function sendTo(turn: Turn, place: Place, asked = false): Reply {
  const { picker, topics } = turn;
  const crash = topics.set.has("crash");
  const json = topics.set.has("json");
  switch (place) {
    case "datapack":
      return {
        text: picker.pick("route.datapack", [
          `oh no! since it's your own pack, ${channel("datapackSupport")} is the place. post the json that's acting up${crash ? " and your latest.log or crash report" : ""} and someone there can help you fix it`,
          `${channel("datapackSupport")} is where people help with packs they made! bring the files that are misbehaving${crash ? " plus the crash log" : ""}, it makes it way easier`,
        ]) + (json ? `. for json syntax mistakes, <${LINKS.jsonChecker}> (or !parser) points at the exact line` : ""),
        gloss: `people in ${channel("datapackSupport")} help fix datapacks you made yourself`,
        act: "route.datapack",
        topic: "datapack",
      };
    case "addon":
      return {
        text: picker.pick("route.addon", [
          `since it's your own addon, ${channel("addonSupport")} is the best place. bring the error and the log and someone can take a look`,
          `${channel("addonSupport")} is for java addon stuff! the addon docs might help too: <${LINKS.addonDocs}>`,
        ]),
        gloss: `${channel("addonSupport")} is where people help with java addons`,
        act: "route.addon",
        topic: "addon",
      };
    case "bug":
      if (asked) {
        return {
          text: picker.pick("route.bug.asked", [
            `bugs go in ${channel("bugReports")}! include your minecraft version, loader, mod list, and the steps to make it happen`,
            `${channel("bugReports")} is the place! say what you did, what you expected, and what happened instead. crash logs help a ton`,
          ]),
          gloss: `bugs in the mods get reported in ${channel("bugReports")}`,
          act: "route.bug",
          topic: "problem",
        };
      }
      return {
        text: picker.pick("route.bug", [
          `that sounds like a bug in the mod! report it in ${channel("bugReports")} with your minecraft version, loader, mod list, and the steps to make it happen${crash ? ". a crash log helps a ton" : ""}`,
          `please drop it in ${channel("bugReports")}! say what you did, what you expected, and what happened instead${crash ? ", and attach the crash report" : ""}`,
        ]),
        gloss: `bugs in the mods themselves get reported in ${channel("bugReports")}`,
        act: "route.bug",
        topic: "problem",
      };
    case "unsure":
      return {
        text: picker.pick("route.ask", [
          "oh no! is that happening because of a datapack or addon you're making, or does it happen with just the mods?",
          "hmm, quick question so i send you to the right place: is it something you made (a datapack or addon), or the mods themselves?",
        ]),
        gloss: "i need to know if the problem comes from something you made or from the mod, so i can send you to the right channel",
        act: "route.ask",
        topic: "problem",
        expect: { kind: "problem_source" },
      };
  }
}

const problem: Responder = turn => sendTo(turn, placeFor(turn.topics));

// The answer to "is it your pack or the mod?".
export function answerProblemSource(turn: Turn): Reply | null {
  if (turn.expectation?.kind !== "problem_source") return null;
  const text = turn.reading.text;
  const topics = findTopics(text, turn.reading.tokens);
  if (/\b(addon|my mod|java|mixin|gradle)\b/.test(text)) return { ...sendTo(turn, "addon"), expect: null };
  if (/\b(mine|my own|i made|my pack|my datapack|datapack|pack|something i made|my power|my origin|json)\b/.test(text)) return { ...sendTo(turn, "datapack"), expect: null };
  if (/\b(mod|mods|origins|apoli|the mod|just the mods|only the mods|vanilla|no datapacks|without datapacks|not mine)\b/.test(text)) return { ...sendTo(turn, "bug"), expect: null };
  if (/\b(do not know|not sure|no idea|unsure|maybe|both)\b/.test(text)) {
    return {
      text: `no worries! if it still happens with only apoli and origins installed, it's a bug for ${channel("bugReports")}. if it only happens with your own pack, ${channel("datapackSupport")} can help`,
      gloss: "if the mods alone cause it, report a bug, and if your pack causes it, ask in datapack support",
      act: "route.both",
      topic: "problem",
      expect: null,
    };
  }
  const place = placeFor(topics);
  return place === "unsure" ? null : { ...sendTo(turn, place), expect: null };
}

const help: Responder = turn => ({
  text: turn.picker.pick("help", [
    `of course! what's going on? i can point you to the right place for bugs, datapack help, addon help, suggestions, or jam stuff`,
    `sure! tell me what's up. is it a bug, a datapack you're making, an idea, or something else?`,
  ]),
  gloss: "i want to help, i just need to know what it's about",
  act: "help",
  expect: { kind: "help_topic" },
});

// The answer to "what do you need help with?".
export function answerHelpTopic(turn: Turn): Reply | null {
  if (turn.expectation?.kind !== "help_topic") return null;
  const text = turn.reading.text;
  const topics = turn.topics;
  const has = (topic: string) => topics.set.has(topic as never);
  let reply: Reply | null = null;
  if (has("problem") || /\b(bug|crash|broken|error)\b/.test(text)) reply = sendTo(turn, placeFor(topics));
  else if (has("addon")) reply = sendTo(turn, "addon");
  else if (has("datapack") || has("json") || has("resourcepack")) reply = { ...sendTo(turn, "datapack"), text: `${MOD_FACTS.datapackStart}. and ${channel("datapackSupport")} is the place to ask questions!` };
  else if (has("suggestion")) reply = suggestion(turn);
  else if (has("jam")) reply = jamInfo(turn);
  else if (has("media")) reply = media(turn);
  else if (has("staff")) reply = contactStaff(turn);
  return reply === null ? null : { ...reply, expect: null };
}

const channels: Responder = () => ({
  text: [
    "here's where things go!",
    `🐛 bugs in the mods: ${channel("bugReports")}`,
    `📦 help with your datapacks: ${channel("datapackSupport")}`,
    `☕ help with java addons: ${channel("addonSupport")}`,
    `💡 ideas: ${channel("suggestions")}`,
    `📸 screenshots and videos: ${channel("mediaGallery")}`,
    `🎉 jams: ${channel("jamInfo")}`,
    "and you can dm me to reach the staff team!",
  ].join("\n"),
  gloss: "i listed which channel is for what",
  act: "channels",
});

const suggestion: Responder = turn => {
  const forGrove = /\b(you|grove)\b/.test(turn.reading.text) && /\b(should|could|can) (you|grove)\b/.test(turn.reading.text) && !/\b(add|origins|apoli|mod)\b/.test(turn.reading.text);
  return {
    text: forGrove
      ? `aw, for me? you can still post it in ${channel("suggestions")} so the team sees it!`
      : turn.picker.pick("suggest", [
        `ooh, an idea! post it in ${channel("suggestions")} so the team can see it and track it :D`,
        `${channel("suggestions")} is the place for ideas! one post per idea makes it easy for the team`,
      ]),
    gloss: `ideas and feature requests go in ${channel("suggestions")}`,
    act: "route.suggestion",
    topic: "suggestion",
  };
};

const media: Responder = turn => ({
  text: turn.picker.pick("media", [
    `${channel("mediaGallery")} is the media gallery! it's only for pictures and videos, so if you want to talk about a post, make a thread on it`,
    `post it in ${channel("mediaGallery")}! just the screenshot or video though, any chatting goes in a thread on the post`,
  ]),
  gloss: `${channel("mediaGallery")} is for screenshots and videos only, and talking happens in threads`,
  act: "route.media",
  topic: "media",
});

const jamInfo: Responder = turn => ({
  text: turn.picker.pick("jam.info", [
    `everything about the jams is in ${channel("jamInfo")}! dates, rules and themes go there. !comp-rules explains the competition part`,
    `check ${channel("jamInfo")} for the jam details! entries go in ${channel("jamSubmissions")} and you can chat about it in ${channel("jamDiscussion")}`,
  ]),
  gloss: `${channel("jamInfo")} has the jam info, like dates, themes and rules`,
  act: "route.jam",
  topic: "jam",
});

const jamSubmit: Responder = turn => ({
  text: turn.picker.pick("jam.submit", [
    `jam entries go in ${channel("jamSubmissions")}! if you want yours in the competition too, tag it with Comp Submission`,
    `submit it in ${channel("jamSubmissions")}! the Comp Submission tag enters it into the competition, and without it it's still a normal jam entry`,
  ]),
  gloss: `you submit jam entries in ${channel("jamSubmissions")}`,
  act: "route.jam_submit",
  topic: "jam",
});

const jamChat: Responder = turn => ({
  text: turn.picker.pick("jam.chat", [`you can talk about the jam in ${channel("jamDiscussion")}! keep it friendly :D`, `${channel("jamDiscussion")} is the jam chat channel!`]),
  gloss: `${channel("jamDiscussion")} is for talking about the jam`,
  act: "route.jam_chat",
  topic: "jam",
});

const compat: Responder = turn => ({
  text: turn.picker.pick("compat", [
    `apoli and origins are made to play nice with most mods! if two mods break together, report it in ${channel("bugReports")} and list both mods`,
    `they work with most other mods! if you find a conflict, ${channel("bugReports")} is the place, with your mod list and a log`,
  ]),
  gloss: "the mods work with most other mods, and conflicts go in bug reports",
  act: "compat",
  topic: "versions",
});

const download: Responder = turn => ({
  text: `${downloadLine()}. you need both, and fabric api too if you're on fabric!`,
  gloss: "that's where you can download apoli and origins",
  act: "download",
  topic: "download",
});

const versions: Responder = turn => {
  const text = turn.reading.text;
  const asked = /\b1\.(\d{1,2})(?:\.(\d{1,2}))?\b/.exec(turn.message.content);
  if (asked !== null) {
    const version = asked[0];
    const supported = version === "1.20.1" || version === "1.21.1";
    const family = version === "1.20" || version === "1.21";
    if (!supported) {
      return {
        text: family
          ? `yep! specifically ${version}.1. apoli and origins are on ${MOD_FACTS.loaders}`
          : `not on ${version}, sorry! right now apoli and origins are on ${MOD_FACTS.loaders}`,
        gloss: `the mods run on ${MOD_FACTS.loaders}`,
        act: "versions",
        topic: "versions",
      };
    }
  }
  let extra = "";
  if (/\bbedrock|pocket|mcpe\b/.test(text)) extra = " it's java edition only, sorry!";
  else if (/\bquilt\b/.test(text)) extra = " quilt can usually run fabric mods, but only fabric is officially supported";
  return { text: `apoli and origins are on ${MOD_FACTS.loaders}.${extra}`, gloss: `the mods run on ${MOD_FACTS.loaders}`, act: "versions", topic: "versions" };
};

const install: Responder = turn => ({
  text: `${MOD_FACTS.install}. downloads: ${downloadLine()}`,
  gloss: "you install both apoli and origins, plus fabric api on fabric",
  act: "install",
  topic: "install",
});

const commands: Responder = turn => ({
  text: turn.picker.pick("commands", [
    "type !help and i'll show you all my commands! you can also just talk to me, say my name or reply to one of my messages",
    "!help has the whole list! and you can always chat with me, i'll do my best",
  ]),
  gloss: "!help lists my commands",
  act: "commands",
  topic: "commands",
});

const contactStaff: Responder = turn => ({
  text: `${SERVER_FACTS.modmail} ${EMOJI.grove}`,
  gloss: "dming me reaches the staff team",
  act: "modmail",
  topic: "staff",
});

const originList: Responder = turn => {
  const names = ORIGINS.map(origin => origin.name.toLowerCase());
  const list = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return { text: `there are ${ORIGINS.length} origins: ${list}! my favorite is slimekin, obviously`, gloss: "i listed the origins that come with the mod", act: "origin_list", topic: "origin" };
};

const bestOrigin: Responder = turn => ({
  text: turn.picker.pick("best_origin", [
    "slimekin!! they're basically my cousins. but honestly, the best one is the one that's most fun for you",
    "i'm biased, slimekin all the way. if you want a challenge, try merling or blazeborn, those are the impact 3 ones",
  ]),
  gloss: "i like slimekin best because they're slimes like me",
  act: "best_origin",
  topic: "origin",
});

const serverInfo: Responder = turn => ({
  text: `${SERVER_FACTS.about}! bugs go in ${channel("bugReports")}, datapack help in ${channel("datapackSupport")}, and ideas in ${channel("suggestions")}`,
  gloss: "this is the overgrown's origins server",
  act: "server_info",
});

function originLine(id: string): string | null {
  const origin = ORIGIN_BY_ID.get(id);
  if (origin === undefined) return null;
  const impact = origin.impact === 0 ? "it has no impact at all" : `its impact is ${origin.impact} out of 3`;
  return `the ${origin.name.toLowerCase()} is ${origin.blurb}. ${impact}`;
}

// "what is X?" Answer what Grove actually knows, admit what it doesn't.
const define: Responder = turn => {
  const term = (turn.intent.slots["term"] ?? "").trim();
  const words = term.split(" ");
  const has = (word: string) => words.includes(word);
  const { picker } = turn;

  if ((has("apoli") || has("opoli")) && (has("origins") || has("difference"))) return { text: `${MOD_FACTS.difference[0]}!`, gloss: "apoli makes powers work and origins lets you pick them", act: "define.difference", topic: "apoli" };
  if (has("apoli") || has("opoli")) return { text: `${picker.pick("def.apoli", MOD_FACTS.apoli)}. the handbook explains it all: <${LINKS.handbook}>`, gloss: "apoli is the engine that makes powers work", act: "define.apoli", topic: "apoli" };
  if (has("origins") || term === "overgrown" || term === "overgrown origins" || term === "this mod" || term === "the mod") return { text: `${picker.pick("def.origins", MOD_FACTS.origins)}! get it here: <${LINKS.originsModrinth}>`, gloss: "origins is the mod where you pick an origin with powers", act: "define.origins", topic: "origins" };
  if (turn.topics.originId !== null && words.length <= 4) {
    const line = originLine(turn.topics.originId);
    if (line !== null) return { text: line, gloss: line, act: "define.origin", topic: "origin" };
  }
  if (has("handbook") || has("wiki") || has("docs") || has("documentation")) return { text: `the handbook is the official guide for apoli and origins! <${LINKS.handbook}>`, gloss: "the handbook is the docs website", act: "define.handbook", topic: "handbook" };
  const meaningful = words.filter(word => !["a", "an", "the", "this", "that", "your", "my", "of"].includes(word));
  const glossary = meaningful.length <= 2 ? GLOSSARY.find(entry => entry.words.some(has)) : undefined;
  if (glossary !== undefined) return { text: glossary.text, gloss: glossary.gloss, act: `define.${glossary.words[0]}`, topic: glossary.topic };
  if (has("datapack") || has("datapacks")) return { text: `a datapack is a folder of json files minecraft loads. with apoli, you can make powers in one! start here: <${LINKS.gettingStarted}>`, gloss: "a datapack is a folder of json files the game loads", act: "define.datapack", topic: "datapack" };
  if (has("power") || has("powers")) return { text: `a power is a json file that gives something an ability, like double jumping or breathing underwater. apoli makes them work! <${LINKS.datapackDocs}>`, gloss: "a power is an ability written in json", act: "define.power", topic: "datapack" };
  if (has("addon") || has("addons")) return { text: `an addon is a java mod built on top of apoli! the docs are here: <${LINKS.addonDocs}> and ${channel("addonSupport")} is the place to ask`, gloss: "an addon is a java mod that builds on apoli", act: "define.addon", topic: "addon" };
  if (has("jam") || has("jams")) return { text: `a jam is an event where everyone makes something around a theme in a set time! ${channel("jamInfo")} has the details`, gloss: "a jam is a building event with a theme and a deadline", act: "define.jam", topic: "jam" };
  if (has("slime") || has("slimes")) return { text: "slimes are bouncy green mobs! i'm one of them. the nicest one, if i say so myself", gloss: "slimes are bouncy mobs like me", act: "define.slime" };
  if (has("grove") || term === "you") return SELF_IDENTITY(turn);
  if (has("fabric") || has("neoforge") || has("forge")) return { text: `that's a mod loader! apoli and origins run on ${MOD_FACTS.loaders}`, gloss: "mod loaders are what load mods into the game", act: "define.loader", topic: "versions" };
  if (has("modrinth") || has("curseforge")) return { text: `it's a site for downloading mods! ${downloadLine()}`, gloss: "a website for downloading mods", act: "define.download", topic: "download" };
  if (has("apace") || has("apace100")) return { text: `${MOD_FACTS.remake[0]}`, gloss: "overgrown's mods are remakes of apace's", act: "define.apace", topic: "origins" };
  if (has("server") || has("discord") || term === "this place" || term === "this server") return { text: `${SERVER_FACTS.about}!`, gloss: "this is the overgrown's origins server", act: "define.server" };
  const slang = words.find(word => SLANG_TERMS[word] !== undefined);
  if (slang !== undefined) return { text: `${slang}? i've heard people say it but i'm way too mossy to understand it`, gloss: `i don't really know what ${slang} means`, act: "define.slang" };

  // A one or two word thing Grove has never heard of gets curiosity. A longer
  // question ("the capital of france") is general knowledge, and Grove says so.
  const safe = words.length <= 2 ? safeWord(term, 24) : null;
  if (safe === null) return null;
  if (meaningful.length === 1 && KNOWN_WORDS.has(meaningful[0]!)) {
    return {
      text: picker.pick("def.common", [`${meaningful[0]}? i know the word, but i couldn't really explain it... i'm a slime!`, `hmm, ${meaningful[0]} is a big word for a little slime. maybe someone here can explain it better`]),
      gloss: "i know the word but i can't explain it",
      act: "define.common",
      miss: true,
    };
  }
  const modish = turn.topics.set.size > 0;
  return {
    text: picker.pick("def.unknown", [`${safe}? i don't know what that is... i'm just a little slime.`, `hmm, i've never heard of ${safe}. is it bouncy?`])
      + (modish ? ` the handbook might know: <${LINKS.handbook}>` : picker.pick("def.unknown.tail", [" maybe someone here knows!", " i mostly know about the server and the mods."])),
    gloss: "i don't know what that is",
    act: "define.unknown",
    miss: true,
  };
};

interface GlossaryEntry {
  words: readonly string[];
  text: string;
  gloss: string;
  topic: string | null;
}

// Words people ask about that Grove can explain in a line or two.
const GLOSSARY: readonly GlossaryEntry[] = [
  { words: ["minecraft"], text: "minecraft! the blocky game where i live. slimes are the best part, obviously", gloss: "minecraft is the game i live in", topic: null },
  { words: ["layer", "layers"], text: `a layer is one pick on the origin screen. origins comes with one, and packs can add more, so you can have an origin AND a class, for example. <${LINKS.originsDocs.replace("overview/", "layers/")}>`, gloss: "a layer is one slot on the origin screen where you pick something", topic: "datapack" },
  { words: ["badge", "badges"], text: "badges are the little icons next to a power on the origin screen that explain things like keybinds. !badges shows how to use them", gloss: "badges are the small icons on the origin screen", topic: "datapack" },
  { words: ["orb"], text: `the orb of origin lets you choose your origin again! it's shiny and i like holding it ${EMOJI.orb}`, gloss: "the orb of origin lets you re-pick your origin", topic: "origin" },
  { words: ["origin"], text: "an origin is a bundle of powers you pick when you spawn, like merling or enderian! the orb of origin lets you pick again", gloss: "an origin is a set of powers you pick at spawn", topic: "origin" },
  { words: ["condition", "conditions"], text: `a condition is a yes or no test, like "is it raining?" or "am i sneaking?". powers and actions use them to decide when to work. <${LINKS.datapackDocs.replace("overview/", "conditions/")}>`, gloss: "a condition is a yes or no test that powers use", topic: "datapack" },
  { words: ["action", "actions"], text: `an action is something that happens, like healing, teleporting, or launching you into the air. powers run them when something triggers. <${LINKS.datapackDocs.replace("overview/", "actions/")}>`, gloss: "an action is something a power makes happen", topic: "datapack" },
  { words: ["mod", "mods"], text: "a mod changes or adds stuff to minecraft! apoli and origins are mods. you put them in your mods folder", gloss: "a mod adds things to minecraft", topic: null },
  { words: ["modpack", "modpacks"], text: "a modpack is a bunch of mods bundled together so everyone plays with the same setup", gloss: "a modpack is a bundle of mods", topic: null },
  { words: ["json"], text: `json is the text format datapacks use! curly brackets, quotes, and lots of commas. <${LINKS.jsonChecker}> checks if yours is valid`, gloss: "json is the text format datapacks are written in", topic: "datapack" },
  { words: ["namespace"], text: "a namespace is the first part of an id, like the origins in origins:merling. your pack picks its own so it doesn't clash with others", gloss: "a namespace is the part of an id before the colon", topic: "datapack" },
  { words: ["resourcepack", "resourcepacks", "texturepack"], text: "a resource pack changes how things look and sound, like textures and models. !bars shows where resource bar sprites go", gloss: "a resource pack changes textures and sounds", topic: "datapack" },
  { words: ["mixin", "mixins"], text: `mixins are how java mods change minecraft's code. that's addon territory, ${channel("addonSupport")} knows way more than me`, gloss: "mixins let java mods change the game's code", topic: "addon" },
  { words: ["love"], text: `love is when someone shares their moss with you for no reason ${EMOJI.heart}`, gloss: "love is being kind to someone", topic: null },
  { words: ["life"], text: "life is mostly naps, moss, and talking to nice people. that's been my experience anyway", gloss: "life is about naps and nice people", topic: null },
  { words: ["friend", "friends", "friendship"], text: "a friend is someone who says hi to you even when you're just a little slime", gloss: "friends are people who are kind to you", topic: null },
  { words: ["moss"], text: "moss is the best thing in the whole world. soft, green, and it grows on me!", gloss: "moss is my favorite thing", topic: null },
  { words: ["frog", "frogs"], text: "frogs are small green monsters that EAT SLIMES. stay away from them", gloss: "frogs eat slimes, so i'm scared of them", topic: null },
  { words: ["rain"], text: "rain is the best weather! it makes me extra bouncy", gloss: "rain makes me happy", topic: null },
  { words: ["tomorrow"], text: "tomorrow is the day after today! anything can happen, that's the fun part", gloss: "tomorrow is the next day", topic: null },
  { words: ["yesterday"], text: "yesterday is the day before today. i barely remember it, slime memory", gloss: "yesterday was the day before", topic: null },
];

function SELF_IDENTITY(turn: Turn): Reply {
  return { text: `that's me! a little slime with moss and flowers who helps people around here ${EMOJI.grove}`, gloss: "i'm grove, the server's slime", act: "identity" };
}

// "how do I X?" and "where do I X?": work out what X is about and send them there.
// `strict` is for messages that only mention a topic: then pack-making advice
// needs a sign they want to make something, or "is your favorite thing the
// orb of origins?" gets a datapack tutorial.
function task(turn: Turn, strict = false): Reply | null {
  const text = turn.intent.slots["task"] ?? turn.reading.text;
  const topics = findTopics(text, text.split(" "));
  const has = (topic: string) => topics.set.has(topic as never);

  if (/\b(report|reporting)\b/.test(text) && (has("problem") || /\bbug|bugs\b/.test(text))) return sendTo(turn, "bug", true);
  if (/\borb\b/.test(text) && !has("problem")) {
    return {
      text: `the orb of origin lets you pick your origin again! how you get one depends on how your world or server is set up. the handbook has the details: <${LINKS.handbook}>`,
      gloss: "the orb of origin lets you re-pick your origin, and how you get one depends on the setup",
      act: "define.orb",
      topic: "origin",
    };
  }
  if (/\b(report|reporting)\b/.test(text) && /\b(user|player|person|someone|member)\b/.test(text)) return contactStaff(turn);
  if (has("suggestion") || /\b(suggest|idea|ideas)\b/.test(text)) return suggestion(turn);
  if (has("jam")) {
    if (/\b(submit|submission|entry|upload|post|enter)\b/.test(text)) return jamSubmit(turn);
    if (/\b(talk|chat|discuss)\b/.test(text)) return jamChat(turn);
    return jamInfo(turn);
  }
  if (has("media") || /\b(screenshot|clip|showcase|show off|my build|my art)\b/.test(text)) return media(turn);
  // "i made a cool build, where should i post it?": sharing something they made.
  if (/\b(post|share|show|upload)\b/.test(text) && /\b(build|builds|made|creation|art|drawing|render|my work|it|this)\b/.test(turn.reading.text)) return media(turn);
  if (has("download") || /\b(get|download) (the )?(mod|mods|origins|apoli)\b/.test(text)) return download(turn);
  if (has("install")) return install(turn);
  if (has("addon")) return sendTo(turn, "addon");
  if (has("problem")) return sendTo(turn, placeFor(topics));
  const making = /\b(make|making|create|creating|add|adding|write|writing|code|coding|start|starting|build|building|set ?up)\b/.test(text);
  if ((!strict || making) && (has("datapack") || has("json") || /\b(power|powers|origin|origins|layer|badge)\b/.test(text))) {
    return {
      text: `${MOD_FACTS.datapackStart}. if you get stuck, ${channel("datapackSupport")} is full of helpful people!`,
      gloss: "the handbook shows how to make powers, and datapack support helps if you get stuck",
      act: "howto.datapack",
      topic: "datapack",
    };
  }
  if (has("resourcepack")) {
    return { text: `for textures and resource bars, !bars shows the new sprite_location and !badges shows how badges work. ${channel("datapackSupport")} can help with the rest`, gloss: "!bars and !badges explain the resource pack bits", act: "howto.resourcepack", topic: "datapack" };
  }
  if (/\b(contact|talk to|reach|message) (the )?(staff|mods|moderators|admins)\b/.test(text)) return contactStaff(turn);
  if (/\b(get help|ask for help|find help|ask a question)\b/.test(text)) return help(turn);
  return null;
}

const howTo: Responder = turn => task(turn) ?? {
  text: turn.picker.pick("howto.unknown", [
    `hmm, i'm not sure about that one! if it's about making packs, ${channel("datapackSupport")} is the place to ask, and the handbook has a ton of stuff: <${LINKS.handbook}>`,
    "ooh, i don't know how to do that... i'm just a slime! maybe someone here knows?",
  ]),
  gloss: "i don't know how to do that",
  act: "howto.unknown",
  miss: true,
};

export const HELP: Partial<Record<IntentId, Responder>> = {
  problem, help, suggestion, media, jam_info: jamInfo, jam_submit: jamSubmit, jam_chat: jamChat,
  download, versions, install, commands, contact_staff: contactStaff, origin_list: originList,
  best_origin: bestOrigin, server_info: serverInfo, define, how_to: howTo, where_to: howTo, channels, compat,
};

// Messages about mod topics that did not match a frame still deserve a helpful answer.
export function topicalFallback(turn: Turn): Reply | null {
  if (turn.topics.set.size === 0 && turn.topics.originId === null) return null;
  const routed = task(turn, true);
  if (routed !== null) return routed;
  if (turn.topics.originId !== null) {
    const line = originLine(turn.topics.originId);
    if (line !== null) return { text: line, gloss: line, act: "define.origin", topic: "origin" };
  }
  const has = (topic: string) => turn.topics.set.has(topic as never);
  if (has("versions")) return versions(turn);
  if (has("download")) return download(turn);
  if (has("install")) return install(turn);
  if (has("jam")) return jamInfo(turn);
  if (has("staff")) return contactStaff(turn);
  if (has("handbook")) return { text: `the handbook is here: <${LINKS.handbook}>`, gloss: "that's the handbook link", act: "define.handbook", topic: "handbook" };
  if (has("apoli") || has("origins") || has("datapack") || has("addon") || has("json") || has("resourcepack")) {
    const support = has("addon") ? channel("addonSupport") : channel("datapackSupport");
    return {
      text: turn.picker.pick("mod.unsure", [
        `hmm, i'm not sure about that one! the handbook might cover it: <${LINKS.handbook}>, and ${support} can answer the tricky stuff`,
        `ooh, that's beyond my mossy brain! try the handbook (<${LINKS.handbook}>) or ask in ${support}`,
      ]),
      gloss: "i don't know, but the handbook or the support channel will",
      act: "mod.unsure",
      topic: has("addon") ? "addon" : "datapack",
      miss: true,
    };
  }
  return null;
}
