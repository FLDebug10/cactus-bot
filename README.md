# Grove

Grove is the slime who lives in the **Overgrown's Origins** Discord server: a little green slime with moss, flowers and a leaf on its head. It chats, has moods, remembers people, and points everyone at the right channel. It also runs the server's utility features: modmail, suggestion tags, custom commands, and the media gallery rules.

Grove does **not** use an LLM. Its "brain" is a rule and pattern engine (see [How Grove thinks](#how-grove-thinks)), so it runs on a tiny server with no GPU.

## Credits

Grove is a group effort:

- **Drizzo** (`_drizzo_`) drew Grove, created the character, and wrote the first code.
- **FLD10** (`_fld10_`) hosts Grove ("feeds him"), set up the repo, and ported the old Carl-bot commands.
- **Overgrown** (`0vergrown`) gave Grove its brain and personality, on top of Drizzo and FLD10's work.

Grove knows all three by their Discord IDs (`CREW` in `src/config.ts`) and greets them as family.

## Who Grove is

Grove's answers about itself all come from one canon, so it never contradicts itself. Change it in `src/brain/content/knowledge.ts` (`LORE`, `TRAITS`, `BELONGINGS`, `HOW_GROVE`, `STORIES`).

- A **pure slime**: the bouncy mob kind, not slime people. The Slimekin are its cousins (and its favorite origin).
- Moss, a few flowers, and one leaf grew on it by themselves. The leaf came from a seed that landed on it.
- Its favorite thing in the world is the **Orb of Origin**, which it holds all the time.
- Scared of **frogs** (they eat slimes) and salt.
- Its birthday is **September 27th, 2026**, the day Drizzo wrote its first code. It knows how old it is.
- It has no gender, so it picks one each morning as a mood (see `state/day.ts`).
- A cactus lived on the server before Grove. Grove has never been a cactus.
- It can't count past seven in its head, so it bounces on a calculator for bigger sums (and gets them right).
- It loves D&D, where slimes are called oozes: its favorite class is druid, its favorite species is plasmoid (ooze people), and the gelatinous cube is its "famous cousin".
- It has no opinions about politics. Ask about Donald Trump and you get an orange joke or a true orange fact instead.

## Running it

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies (Node **22.18+**, which runs the TypeScript directly). |
| `npm start` | Starts the bot. Needs `TOKEN` in `.env`. |
| `npm run chat` | Talk to Grove's brain in the terminal. No Discord, no token. |
| `npm test` | Runs the test suite (`node --test`). |
| `npm run check` | Type-checks everything with TypeScript (`tsc --noEmit`). |
| `npm run speller` | Regenerates Grove's protected word list. Run it after changing the typo targets. |

### Settings (`.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `TOKEN` | required | The bot token. |
| `DATABASE_PATH` | `data/database.db` | SQLite file. In Docker this is `/app/data/database.db`, kept by the compose volume. |
| `GROVE_TIMEZONE` | `America/New_York` | Grove's sense of morning and night. |
| `GROVE_HELP_UNANSWERED` | `true` | Grove answers obvious "where does this go?" questions that nobody answered within 45 seconds. |
| `GROVE_MODERATE_MEDIA` | `true` | Removes text-only posts from the media gallery and posts the `!media` rules (they delete themselves after 30 s). Needs **Manage Messages** there. People who can Manage Messages themselves are never moderated, so test it from a normal account. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. |

Channel, role, tag and emoji IDs live in `src/config.ts`.

> **Deploying:** every push to `master` builds the Docker image and deploys it to the server automatically (`.github/workflows/docker-publish.yml`). Run `npm test` before pushing.

## Layout

```
src/
  index.ts              wires everything together and routes each message
  config.ts             every channel, role, tag, emoji, link and setting
  logger.ts
  brain/                Grove's mind; never touches discord.js
    grove.ts            the brain: decides whether to speak and what to say
    types.ts            the neutral message and decision shapes
    text/               reading: cleanup, slang, contractions, typo repair
    understand/         meaning: intents, topics, who is being addressed, sentiment, sums
    state/              short-term conversations, mood, daily life, long-term memory
    respond/            what to say, per kind of message, and Grove's typing voice
    content/            word lists, lexicons, slang, facts about the mods, the server, d&d and more
  commands/             !commands (one declarative list) and the /register slash commands
  features/             chat adapter, modmail, media gallery, suggestion tags
  discord/              discord.js setup and small helpers
  db/                   SQLite: migrations and one small store per table
scripts/                chat.ts (terminal chat), speller-audit.ts
test/                   node:test suites, including the bug-report conversations
assets/                 images used by !bars and !badges
```

## How Grove thinks

Every message goes through the same steps:

1. **Read** (`brain/text/reader.ts`). Strip mentions, links and code, unroll "heyyyy", expand contractions and slang ("ur", "wdym", "hru"), and repair typos toward the words that matter ("datpack", "sugestion"). Real English words are never "corrected": `realWords.ts` lists the ones that sit a typo away from a target, and a test checks all ~275k English words.
2. **Understand** (`brain/understand/`).
   - *Addressing*: is Grove being talked **to** (@mention, a reply to Grove, "hey grove", "grove, ...", or mid-conversation), talked **about** ("grove is so cute"), or not involved?
   - *Intents*: ordered sentence frames on the cleaned text ("are you X", "you are X", "how is your day", "where do I X"...). The word in "are you X" decides the meaning through the lexicons: "are you a girl" is a gender question, "are you dumb" a jab, "you are funny" a compliment. A question counts as one by its question word, so "grove what time is it" needs no question mark.
   - *Plans*: one message can hold several things. "ur adorable, do u think u'll fit in my 40 pockets?" gets a quick thank-you and then the real answer, and two questions in one message get two answers.
   - *Topics*: what it is about (datapacks, addons, a bug, the jam...) and **whose** problem it is: "my datapack crashes" goes to datapack support, "Origins crashes" to bug reports, and an unclear "my game crashes" gets a question back.
3. **Remember** (`brain/state/`).
   - *Conversations*: what was said in each channel, every line Grove said and to whom, and what it **meant** (its "gloss"), so "tf does that even mean?" from anyone gets a real explanation. Several people can talk to Grove at once, and someone can chime in on a reply meant for someone else.
   - *Expectations*: when Grove asks something ("is it your pack or the mod?"), the next answer is read as the answer.
   - *Follow-ups*: every line remembers the question it answered, so "what about tomorrow?", "and color?" or "tell me more" re-ask that question about the new thing.
   - *Mood*: how good Grove feels and how much energy it has. Kindness and meanness move it, and it drifts back to bubbly. Repeated meanness makes Grove go quiet for a while until someone apologizes.
   - *Day*: what Grove did today and the gender it feels like today (it is a slime, so it picks one each morning). The same all day, new tomorrow.
   - *Memory* (SQLite): names, nicknames, how warm Grove feels toward each person, and the messages it failed to understand.
4. **Respond** (`brain/respond/`). Each intent has a responder that picks from varied lines without repeating itself. Silly questions get answers in character: what Grove has ("do you have pockets?"), what scares it, what it would do as a human, the time and weather in its moss patch, small requests ("say something", "tell me a story", "count to 10"), and roleplay ("*puts grove in pocket*"). Then the voice filter makes it Grove: lowercase (a word written in capitals on purpose, like "frogs EAT slimes", stays), no em dashes or semicolons, at most one custom emoji, and a small flourish that follows its mood (never on sad news or help answers).

### What Grove can talk about

| People say | Grove does |
| --- | --- |
| "whats 24 divided by 5", "what is 20 time 30", "50*(12+8)", "15% of 80", "solve 2x + 3 = 7", "is 7 x 8 56?" | Works it out (`understand/arithmetic.ts`): words or symbols, brackets, powers, roots, percentages, remainders, simple equations, checking an answer. "i rate it 10/10" or "2-3 weeks" are never taken for sums. |
| "can you do my homework", "help me with math", "my essay is due tomorrow" | Can't do it (no hands), but cheers them on, helps with the math part, asks what subject it is, and wishes luck on tests. |
| "i'm your biggest fan, posters of you all over england" | Gets flustered and excited about whatever they said: posters (and where), fan clubs, autographs, fan art, tattoos, naming a pet after it. |
| "what are dumb questions", "why is there a zero button on the microwave?" | Explains them with an example, gives its own dumb answers to classic dumb questions, and asks its own ("ask me a dumb question"). |
| "can u tell me some commands you have?" | Replies with the `!help` list itself. |
| "what's your favourite D&D class?", "what's a gelatinous cube", "roll for initiative", "roll 2d6+3" | Knows D&D classes, species, monsters (oozes!) and rules terms, its own favorites, and slimes in other games (Dragon Quest, Rimuru, Slime Rancher, Terraria). |
| "what do you think of Donald Trump?" | An orange joke or an orange fact. Other politics gets a polite "the server stays politics free". |
| "are you mewing", "do you mew", "hit the griddy", "do you mog", "what does rizz mean" | Slang is answered the way it was used: asked about Grove, asked of Grove, said about Grove, said about yourself, or asked what it means. Some words Grove deliberately never explains.

### When Grove speaks up

| Situation | Grove does |
| --- | --- |
| Mentioned, replied to, or called by name | Answers. |
| Mid-conversation, no name | Answers questions and follow-ups, stays out of other people's chats. |
| Talked about ("grove is cute") | A heart reaction, or a hand raised for questions about itself. At most once per 2 minutes per channel. |
| Someone asks where to report a bug, submit to the jam, etc. | Waits 45 seconds. If no person answered, points them to the channel. |
| Suggestion and modmail forums, the media gallery | Stays quiet. |
| Staff ran `!hush` | Only answers @mentions until it wears off. |

Grove never pings anyone.

## Teaching Grove something new

- **A new kind of message**: add a frame to `FRAMES` in `src/brain/understand/intents.ts` (and the id to `IntentId`), then a responder in the matching `src/brain/respond/*.ts` file.
- **New facts**: `src/brain/content/knowledge.ts` (mods, origins, server, and Grove's own canon) or the glossary in `src/brain/respond/help.ts`.
- **Things Grove can do**: `ABILITIES` in `src/brain/content/lexicon.ts` answers "can you X?", "do you X?" and "X!" all at once.
- **New slang**: add a term to `SLANG` in `src/brain/content/slang.ts`, with its meaning and lines for each way it gets used (asked, told, said about Grove, said about yourself). Put phrases before the single words inside them.
- **D&D and fantasy**: `src/brain/content/fantasy.ts`. **Dumb questions and orange facts**: `src/brain/content/silly.ts`. `test/content.test.ts` checks every line there for dashes and semicolons.
- **Other words**: `src/brain/content/words.ts` and `lexicon.ts`. If you add a word to `CORRECTION_TARGETS`, run `npm run speller`.
- **See what Grove got wrong**: staff can run `!misses` in Discord.
- Add a test next to the ones in `test/conversation.test.ts`, and try it out with `npm run chat`.

## Commands

`!help` lists everything. Staff and contributor commands: `!say`, `!claim`, `!close`, `!closemail`, `!comp-rules`, `!hush [minutes]`, `!unhush`, `!misses`. When staff use a redirect command (`!rbr`, `!rds`, `!ras`, `!rsg`, `!media`, ...) as a reply to someone's message, Grove answers that person directly.

Custom commands are added with `/register` and removed with `/unregister`.
