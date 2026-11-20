
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { fileURLToPath } from "node:url";
import { CHANNELS, LINKS } from "../config.ts";
import { MEDIA_RULES } from "../texts.ts";
import { answer, type Command } from "./command.ts";

const asset = (name: string) => fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));

// Handbook Search

interface HandbookPage {
  title: string;
  url: string;
  content: string;
}

const HANDBOOK_BASE = "https://0vergrown.github.io/Handbook/";
const HANDBOOK_CACHE_MS = 30 * 60 * 1000;
const HANDBOOK_MAX_PAGES = 180;

let handbookCache: HandbookPage[] = [];
let handbookCacheTime = 0;
let handbookIndexPromise: Promise<HandbookPage[]> | null = null;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    );
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function normalizeSearch(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 1)
    .map(word =>
      word.length > 4 && word.endsWith("s")
        ? word.slice(0, -1)
        : word,
    );
}

async function fetchHandbookPage(
  url: string,
): Promise<{ page: HandbookPage; links: string[] } | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "CactusBot-HandbookSearch/1.0",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const main =
      html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;

    const title = decodeHtml(
      main
        .match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .trim() ?? "",
    );

    if (!title) return null;

    const content = htmlToText(main);

    const links = [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .map(match => {
        try {
          const link = new URL(decodeHtml(match[1]), url);

          link.hash = "";
          link.search = "";

          if (
            link.origin !== "https://0vergrown.github.io" ||
            !link.pathname.startsWith("/Handbook/docs/")
          ) {
            return null;
          }

          return link.href.endsWith("/")
            ? link.href
            : `${link.href}/`;
        } catch {
          return null;
        }
      })
      .filter((link): link is string => link !== null);

    return {
      page: { title, url, content },
      links,
    };
  } catch {
    return null;
  }
}

async function buildHandbookIndex(): Promise<HandbookPage[]> {
  const queue = [
    `${HANDBOOK_BASE}docs/datapack/`,
    `${HANDBOOK_BASE}docs/addon/`,
    `${HANDBOOK_BASE}docs/compatibility/`,
  ];

  const visited = new Set<string>();
  const pages: HandbookPage[] = [];

  while (queue.length > 0 && visited.size < HANDBOOK_MAX_PAGES) {
    const batch = queue.splice(0, 8)
      .filter(url => !visited.has(url));

    if (batch.length === 0) break;

    for (const url of batch) {
      visited.add(url);
    }

    const results = await Promise.all(
      batch.map(fetchHandbookPage),
    );

    for (const result of results) {
      if (!result) continue;

      pages.push(result.page);

      for (const link of result.links) {
        if (
          !visited.has(link) &&
          queue.length + visited.size < HANDBOOK_MAX_PAGES * 2
        ) {
          queue.push(link);
        }
      }
    }
  }

  if (pages.length === 0) {
    throw new Error("Could not retrieve handbook documentation.");
  }

  return pages;
}

async function getHandbookIndex(): Promise<HandbookPage[]> {
  if (
    handbookCache.length > 0 &&
    Date.now() - handbookCacheTime < HANDBOOK_CACHE_MS
  ) {
    return handbookCache;
  }

  if (handbookIndexPromise) {
    return handbookIndexPromise;
  }

  handbookIndexPromise = buildHandbookIndex()
    .then(pages => {
      handbookCache = pages;
      handbookCacheTime = Date.now();
      return pages;
    })
    .finally(() => {
      handbookIndexPromise = null;
    });

  return handbookIndexPromise;
}

function searchHandbook(
  pages: HandbookPage[],
  query: string,
): HandbookPage[] {
  const terms = normalizeSearch(query);

  if (terms.length === 0) return [];

  const normalizedQuery = terms.join(" ");

  return pages
    .map(page => {
      const title = normalizeSearch(page.title).join(" ");
      const content = normalizeSearch(page.content).join(" ");

      let score = 0;

      if (title === normalizedQuery) score += 30;
      if (title.includes(normalizedQuery)) score += 20;

      for (const term of terms) {
        if (title.includes(term)) score += 8;
        if (content.includes(term)) score += 2;
      }

      if (terms.every(term => title.includes(term))) {
        score += 15;
      } else if (terms.every(term => content.includes(term))) {
        score += 5;
      }

      return { page, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(result => result.page);
}

// Info Commands

export const INFO_COMMANDS: readonly Command[] = [
  {
    name: "rbr",
    description: "Redirect bug reports",
    run: context => answer(context, `Please use <#${CHANNELS.bugReports}> to report any bugs you encounter.
Alternatively you can use \`!report [Thread name] [Message] [Apoli/Origins/Wiki] [Image link if needed]\` to report it for you!

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
    usage: "!wiki [subject]",
    description: "Searches the Overgrown Handbook",
    run: async context => {
      const query = context.args.trim();

      if (!query) {
        return answer(
          context,
          `📘 **Overgrown Handbook**\n${LINKS.datapackDocs}`,
        );
      }

      try {
        const pages = await getHandbookIndex();
        const results = searchHandbook(pages, query);

        if (results.length === 0) {
          return answer(
            context,
            `🔎 No handbook results found for **${query}**.\nTry different keywords or browse the handbook:\n${LINKS.datapackDocs}`,
          );
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("📘 Handbook Search")
          .setDescription(`Results for **${query}**`);

        for (const page of results) {
          const description = page.content.slice(0, 500);

          embed.addFields({
            name: page.title,
            value: `${description}${page.content.length > 500 ? "..." : ""}\n\n[View documentation](${page.url})`,
          });
        }

        embed.setFooter({
          text: `${results.length} result${results.length === 1 ? "" : "s"} found`,
        });

        return answer(context, { embeds: [embed] });
      } catch (error) {
        console.error("[Handbook Search]", error);

        return answer(
          context,
          `⚠️ I couldn't retrieve the handbook right now. Please try again later.\n${LINKS.datapackDocs}`,
        );
      }
    },
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
    description: "Shows how to use badges and their sprite locations",
    run: context => answer(context, {
      content: `**Badge Sprite Locations**

The locations for badge sprites are:

\`"sprite": "origins:textures/gui/badge/silent/folder/badge.png"\`
-# and
\`"sprite": "origins:textures/gui/badge/isaacfanta/badge.png"\``,
      embeds: [
        new EmbedBuilder().setImage("attachment://badges.png"),
        new EmbedBuilder().setImage("attachment://badges2.png"),
      ],
      files: [
        new AttachmentBuilder(asset("badges.png"), { name: "badges.png" }),
        new AttachmentBuilder(asset("badges2.png"), { name: "badges2.png" }),
      ],
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
