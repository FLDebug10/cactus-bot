import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { fileURLToPath } from "node:url";
import { CHANNELS, LINKS } from "../config.ts";
import { MEDIA_RULES } from "../texts.ts";
import { answer, type Command } from "./command.ts";

const asset = (name: string) => fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));

export const INFO_COMMANDS: readonly Command[] = [
  {
    name: "rbr",
    description: "Redirect bug reports",
    run: context => answer(context, `Please use <#${CHANNELS.bugReports}> to report any bugs you encounter.
Or you can use \`!report [Thread name] [Message] [Apoli/Origins/Wiki] [Image link if needed]\` to report it for you!

This helps keep bug reports organized and makes it easier to track and address issues without cluttering the main discussion channels.`),
  },
  {
    name: "rds",
    description: "Redirect datapack support",
    run: context => answer(context, `Please use <#${CHANNELS.datapackSupport}> for help with making powers and datapacking.

This helps avoid clutter in channels used for discussion and chatting with others.`),
  },
  {
    name: "ras",
    description: "Redirect addon support",
    run: context => answer(context, `Please use <#${CHANNELS.addonSupport}> for help with making Java addons for Apoli and Origins.

The addon docs are a good place to start: <${LINKS.addonDocs}>`),
  },
  {
    name: "rsg",
    description: "Redirect suggestions",
    run: context => answer(context, `Please post ideas and feature requests in <#${CHANNELS.suggestions}>, one post per idea.

That way the team can review, discuss and track each one.`),
  },
  {
    name: "jam",
    description: "Where everything about the jams lives",
    run: context => answer(context, `**Jams**
📜 Info, dates, themes and rules: <#${CHANNELS.jamInfo}>
📦 Submit your entry: <#${CHANNELS.jamSubmissions}>
💬 Talk about it: <#${CHANNELS.jamDiscussion}>`),
  },
  {
    name: "media",
    description: "Explains the media gallery rules",
    run: context => answer(context, MEDIA_RULES),
  },
  {
    name: "parser",
    description: "Drops a JSON validator link",
    run: context => answer(context, `Having trouble finding an error in your JSON?

Use JSON Checker to quickly validate your code and spot syntax mistakes:

🔗 ${LINKS.jsonChecker}

> Helpful for catching missing commas, brackets, quotation marks, and other JSON formatting errors.`),
  },
  {
    name: "handbook",
    aliases: ["wiki"],
    description: "Sends the Overgrown Handbook link",
    run: context => answer(context, `📘 **Overgrown Handbook**\n${LINKS.datapackDocs}`),
  },
  {
    name: "bars",
    description: "Explains the new `sprite_location`",
    run: context => answer(context, {
      content: `The sprite location for resource bars has changed slightly when moving from **Apace's Origins** to **Overgrown's Origins**.

The new location is:
\`"sprite_location": "origins:textures/gui/sprites/hud_render/<artist_name>/resource_bar_#.png"\``,
      embeds: [new EmbedBuilder().setImage("attachment://bars.png")],
      files: [new AttachmentBuilder(asset("bars.png"), { name: "bars.png" })],
    }),
  },
  {
    name: "badges",
    description: "Shows how to use badges",
    run: context => answer(context, {
      embeds: [new EmbedBuilder().setImage("attachment://badges.png")],
      files: [new AttachmentBuilder(asset("badges.png"), { name: "badges.png" })],
    }),
  },
  {
    name: "comp-rules",
    description: "Posts the competitive jam rules",
    staffOnly: true,
    run: context => answer(context, `**Competitive Jam Rules**

This jam will include an optional competition alongside the usual jam submissions.

To enter your submission into the competition, tag it with \`Comp Submission\` when submitting it.

If you do not use the \`Comp Submission\` tag, your entry will still count as a normal jam submission and you will still receive the jam participant role. The competition is completely optional.

**How judging works**
Once submissions close, the finalists will be chosen in two ways:
- The moderation team will select 2–3 submissions to move forward.
- The community will also choose 1 submission to move forward.
Once the finalists have been selected, a community poll will be held to decide the overall 1st place winner.

The winner will receive a custom Discord emoji dedicated to them and their winning submission, which will be added to the server.

**Competitive conduct**
Please keep the competition friendly.

The purpose of the jam is still to create something, have fun, and see what everyone comes up with. Do not turn the jam-discussion channel into arguments, rivalry, campaigning, putting down other submissions, or overly competitive behaviour.

You are welcome to be excited about your entry and discuss the competition, but keep it respectful toward everyone taking part.

If the competitive format causes repeated scuffles or creates a negative atmosphere, we will stop running competitive jams in the future.

Winning is a bonus. The jam itself comes first.`),
  },
];
