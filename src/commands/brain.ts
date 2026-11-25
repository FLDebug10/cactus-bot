import type { BrainStatus } from "../grove/brain.ts";
import { isStaff } from "../discord/members.ts";
import type { Command } from "./command.ts";

const since = (at: number) => `<t:${Math.floor(at / 1000)}:R>`;
const WHERE: Readonly<Record<string, string>> = { local: "on overgrown's computer", cloud: "on ollama's cloud" };

function line(status: BrainStatus, now: number, staff: boolean): string {
  const where = WHERE[status.name] ?? status.name;
  const credits = status.credits !== null ? `, ${status.credits}` : "";
  if (status.online && status.restingUntil > now) return `😴 **${status.model}** ${where}: resting until ${since(status.restingUntil)} (${status.restReason ?? "taking a break"})`;
  if (status.online) return `✅ **${status.model}** ${where}${credits}`;
  return `💤 **${status.model}** ${where}: napping since ${since(status.since)}${staff && status.reason !== null ? ` (${status.reason})` : ""}`;
}

export const BRAIN_COMMANDS: readonly Command[] = [
  {
    name: "brain",
    usage: "!brain",
    description: "Shows whether my chatting brain is awake",
    run: async ({ message, args, services }) => {
      if (args.trim().toLowerCase() === "sync") {
        if (!isStaff(message.member)) return message.reply("only staff can make me re-read everything!");
        if (services.knowledgeSync === null) return message.reply("i don't have a library to read, sorry!");
        await message.reply("okay! re-reading the handbook and the mods' code, give me a minute 📚");
        const results = await services.knowledgeSync.syncAll(true);
        const lines = results.map(result => result.status === "failed" ? `- ${result.source}: couldn't (${result.error ?? "unknown"})` : `- ${result.source}: ${result.files ?? 0} files, ${result.chunks ?? 0} pieces`);
        return message.reply(`done!\n${lines.join("\n")}`);
      }

      const statuses = await services.brain.check();
      const now = Date.now();
      const active = services.brain.active;
      const lines = [
        active === null
          ? "💤 all my brains are napping, so i can't chat right now. every command still works though!"
          : `🧠 i'm awake! chatting with **${active.status.model}** ${WHERE[active.name] ?? ""}`.trimEnd(),
        ...statuses.map(status => `- ${line(status, now, isStaff(message.member))}`),
      ];

      const sources = services.knowledge?.sources() ?? [];
      if (sources.length === 0) lines.push("📚 my library of the handbook and the mods' code is still downloading");
      else {
        // The Handbook and the main build of each mod are listed; the other builds (1.20.1, NeoForge) are a count.
        const main = sources.filter(source => !source.name.includes("-"));
        const other = sources.length - main.length;
        const shown = main.map(source => `${source.name} (${source.files} files, checked ${since(source.syncedAt)})`).join(", ");
        lines.push(`📚 library: ${shown}${other > 0 ? `, and the 1.20.1 and NeoForge code (${other} more)` : ""}`);
      }
      return message.reply({ content: lines.join("\n"), allowedMentions: { parse: [] } });
    },
  },
];
