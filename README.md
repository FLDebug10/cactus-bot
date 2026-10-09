# Grove

Grove is the slime who lives in the **Overgrown's Origins** Discord server: a little green slime with moss, flowers and a leaf on its head. It chats, helps with Apoli and Origins, and runs the server's utility features: commands, modmail, suggestion tags, custom commands, the media gallery rules and a little moderation.

Grove is a **hybrid**:

- The bot runs on a small Azure VM (no GPU). Commands, modmail, moderation and the rules below always work there.
- Its **chatting brain** is a language model served by [Ollama](https://ollama.com): a model on Overgrown's computer (reached through an SSH tunnel; free and unlimited while that computer is on), and optionally a model on Ollama's cloud (always on, but with monthly credits). Grove asks them in order, so the cloud can answer first and the local model takes over when the credits run out. With a brain awake, Grove chats like a member of the server, with the recent conversation as context, and looks things up in the Handbook and the mods' source code. With none awake, Grove is a command bot that answers chat with a sleepy 💤.

Setting up the brain: [deploy/brain/SETUP.md](deploy/brain/SETUP.md).

## Credits

Grove is a group effort:

- **Drizzo** (`_drizzo_`) drew Grove, created the character, and wrote the first code.
- **FLD10** (`_fld10_`) hosts Grove ("feeds him"), set up the repo, and ported the old Carl-bot commands.
- **Overgrown** (`0vergrown`) gave Grove its brain and personality, on top of Drizzo and FLD10's work.

Grove knows all three by their Discord IDs (`CREW` in `src/config.ts`). Drizzo and FLD10 are a couple, so Grove's two **dads** are the two of them.

## Who Grove is

Everything the brain is told about Grove lives in `src/grove/persona.ts`, so it never contradicts itself:

- A **pure slime**: the bouncy mob kind, not slime people. The Slimekin are its cousins (and its favorite origin).
- Moss, a few flowers, and one leaf grow on it. Its favorite thing in the world is the **Orb of Origin**, which it holds all the time.
- Scared of **frogs** (they eat slimes) and salt. Its birthday is **September 27th, 2026**, the day Drizzo wrote its first code.
- It has no gender, so it picks one each morning as a mood (`src/grove/day.ts`, the same all day, new tomorrow, with what it did today).
- A cactus lived on the server before Grove. Grove has never been a cactus.
- It types by bouncing on the keyboard (short messages), and can't count past seven in its head, so it uses a calculator tool for math.
- It loves D&D: favorite class druid, favorite species plasmoid, the gelatinous cube is its "famous cousin".
- No opinions about politics. Ask about Donald Trump and you get an orange joke or a true orange fact.

Grove's voice is enforced after the model writes (`src/grove/voice.ts`): lowercase, no em dashes, en dashes or semicolons, at most one custom emoji, no pings, and links only to trusted sites.

## What Grove does

| Someone...                                                                                | Grove                                                                                                                                                                                                   |
|-------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| mentions Grove, replies to it, or says its name ("hey grove", "grove, how do i...")       | answers with the brain, using the last ~16 messages, the replied-to message, the thread's first post, attached text files (power JSON, logs) and screenshots                                            |
| keeps talking right after Grove answered them                                             | the brain decides whether it was meant for Grove, and stays quiet if not                                                                                                                                |
| asks about Apoli, Origins, powers, datapacks, crashes                                     | Grove reads matching Handbook pages first, and can search the Handbook and the Apoli/Origins source with tools before answering, linking the page it used                                               |
| asks anything about **explosives** (bombs, dynamite, C4, grenades, TNT...)                | always gets Minecraft's TNT recipe image and a joke, with or without the brain. A modding question that only mentions TNT next to powers, commands or ids goes to the brain as normal                   |
| asks anything **sexual or explicit**                                                      | gets a warning that it isn't appropriate and that they'll be timed out if it continues. Within 24 hours, the second time is a 10 minute timeout and later ones an hour. Works with or without the brain |
| asks "where do I report a bug / post an idea / submit to the jam" to nobody in particular | if no person answered within 45 seconds, Grove points to the right channel (brain not needed)                                                                                                           |
| talks to Grove while the brain is asleep                                                  | a 💤 reaction, and at most every 15 minutes per channel a short note that commands still work                                                                                                           |

Grove never chats in the suggestion and modmail forums or the media gallery, and staff can quiet it in a channel with `!hush`.

## Running it

| Command                     | What it does                                                                                                                     |
|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `npm install`               | Installs dependencies (Node **22.18+**, which runs the TypeScript directly).                                                     |
| `npm start`                 | Starts the bot. Needs `TOKEN` in `.env`.                                                                                         |
| `npm run chat`              | Talk to Grove's brain in the terminal, no Discord. Needs a local Ollama.                                                         |
| `npm run knowledge -- sync` | Downloads the Handbook and Apoli/Origins source into the local index. `docs <words>` / `code <words>` / `page <slug>` search it. |
| `npm test`                  | Runs the test suite (`node --test`).                                                                                             |
| `npm run check`             | Type-checks everything with TypeScript (`tsc --noEmit`).                                                                         |

### Settings (`.env`)

| Variable                        | Default                  | Meaning                                                                                                                                                                                                                                            |
|---------------------------------|--------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `TOKEN`                         | required                 | The bot token.                                                                                                                                                                                                                                     |
| `DATABASE_PATH`                 | `data/database.db`       | SQLite file. In Docker this is `/app/data/database.db`, kept by the compose volume.                                                                                                                                                                |
| `GROVE_TIMEZONE`                | `America/New_York`       | Grove's sense of morning and night.                                                                                                                                                                                                                |
| `GROVE_BRAIN_URL`               | `http://127.0.0.1:11434` | Where Ollama answers (the end of the SSH tunnel on the VM).                                                                                                                                                                                        |
| `GROVE_BRAIN_MODEL`             | `qwen3.5:4b`             | The model to chat with. It must be pulled on the PC.                                                                                                                                                                                               |
| `GROVE_BRAIN_CONTEXT`           | `8192`                   | Context size in tokens. More remembers more, but needs more GPU memory.                                                                                                                                                                            |
| `GROVE_BRAIN_KEEP_ALIVE`        | Ollama's                 | How long the model stays loaded after a reply, e.g. `15m`.                                                                                                                                                                                         |
| `GROVE_BRAIN_THINK`             | `false`                  | Let thinking models reason first. Smarter, much slower.                                                                                                                                                                                            |
| `GROVE_BRAIN_TIMEOUT_MS`        | `120000`                 | Longest wait for one reply.                                                                                                                                                                                                                        |
| `GROVE_BRAIN_VISION`            | `true`                   | Show attached screenshots to models that can see.                                                                                                                                                                                                  |
| `GROVE_BRAIN_DRAFT_TOKENS`      | off                      | For `-mtp` models (e.g. `qwen3.5:4b-mtp-q4_K_M`): tokens to guess ahead, which speeds up replies. Try `3`.                                                                                                                                         |
| `GROVE_CLOUD_API_KEY`           | none                     | An [Ollama API key](https://ollama.com/settings/keys). Without one the cloud brain is off. `OLLAMA_API_KEY` works too.                                                                                                                             |
| `GROVE_CLOUD_MODEL`             | `glm-5.3-flash`          | The cloud model ([list](https://ollama.com/search?c=cloud)). It must be on your Ollama plan.                                                                                                                                                       |
| `GROVE_CLOUD_FIRST`             | `true`                   | `true`: the cloud answers first, the local model when credits run out. `false`: the local model answers, the cloud only while the computer is off.                                                                                                 |
| `GROVE_CLOUD_CONTEXT`           | `32768`                  | Context size for the cloud model.                                                                                                                                                                                                                  |
| `GROVE_OFFLINE_NOTICE`          | `true`                   | Explain the 💤 when people talk to Grove while the brain is asleep.                                                                                                                                                                                |
| `GROVE_KNOWLEDGE_PATH`          | `data/knowledge.db`      | The Handbook/source index. Safe to delete, it rebuilds from GitHub.                                                                                                                                                                                |
| `GROVE_KNOWLEDGE_REFRESH_HOURS` | `6`                      | How often to check GitHub for new commits.                                                                                                                                                                                                         |
| `GROVE_EXPLICIT_TIMEOUTS`       | `true`                   | Time out people who keep asking explicit questions (needs **Moderate Members**). `false` only warns.                                                                                                                                               |
| `GROVE_HELP_UNANSWERED`         | `true`                   | Point unanswered "where does this go?" questions to the right channel after 45 seconds.                                                                                                                                                            |
| `GROVE_MODERATE_MEDIA`          | `true`                   | Removes text-only posts from the media gallery and posts the `!media` rules (they delete themselves after 30 s). Needs **Manage Messages** there. People who can Manage Messages themselves are never moderated, so test it from a normal account. |
| `LOG_LEVEL`                     | `info`                   | `debug`, `info`, `warn` or `error`.                                                                                                                                                                                                                |

Channel, role, tag and emoji IDs live in `src/config.ts`.

> **Deploying:** every push to `master` builds the Docker image and deploys it to the server automatically (`.github/workflows/docker-publish.yml`). Run `npm test` and `npm run check` before pushing. The compose file on the VM is not deployed by the workflow; see [deploy/brain/SETUP.md](deploy/brain/SETUP.md) for the one change it needs.

## Layout

```
src/
  index.ts              wires everything together and routes each message
  config.ts             every channel, role, tag, emoji, link and setting
  grove/                the brain side; never touches discord.js
    brain.ts            one Ollama endpoint (health, credits, a reply with tool calls) and the chain that falls back between them
    brains.ts           the cloud and local brains built from .env
    persona.ts          who Grove is, and the "right now" part (time, day, who's talking)
    prompt.ts           persona + notes + conversation, fitted to the context size
    reflexes.ts         explosives and explicit content, the same with or without the brain
    voice.ts            Grove's typing rules applied to every reply
    addressing.ts       is this message for Grove?
    history.ts          the last messages per channel, in memory
    tools.ts            what the model may call: handbook/source search, calculator, dice
    knowledge/          GitHub tarball sync, chunking, and the SQLite full-text index
    day.ts arithmetic.ts dice.ts
  features/             chat (the Discord side of the brain), signpost, modmail, media gallery, suggestion tags
  commands/             !commands (one declarative list) and the /register slash commands
  discord/              discord.js setup and small helpers
  db/                   SQLite: migrations and one small store per table
deploy/brain/           setup guide, the SSH tunnel service and the Ollama settings for the PC
scripts/                chat.ts (terminal chat), knowledge.ts (library)
test/                   node:test suites
assets/                 images used by !bars, !badges and the TNT reflex
```

## Teaching Grove something new

- **Facts about Grove, the server or the mods:** `src/grove/persona.ts`. Keep it short, it is sent with every reply.
- **Mod knowledge:** comes from the Handbook and the source on GitHub automatically (`KNOWLEDGE.sources` in `src/config.ts`). Update the Handbook and Grove knows within six hours, or run `!brain sync`.
- **Channels Grove points to:** `PURPOSES` in `src/features/chat.ts` and the pointers in `src/features/signpost.ts`.
- **Things that must never depend on the model:** `src/grove/reflexes.ts`, with tests in `test/grove/reflexes.test.ts`.

## Commands

`!help` lists everything. `!brain` says whether the chatting brain is awake (staff can run `!brain sync` to refresh the Handbook and source index). Staff and contributor commands: `!say`, `!claim`, `!close`, `!closemail`, `!comp-rules`, `!hush [minutes]`, `!unhush`. When staff use a redirect command (`!rbr`, `!rds`, `!ras`, `!rsg`, `!media`, ...) as a reply to someone's message, Grove answers that person directly.

Custom commands are added with `/register` and removed with `/unregister`.
