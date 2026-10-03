import { AttachmentBuilder, type Client, type Message } from "discord.js";
import { fileURLToPath } from "node:url";
import type { Grove } from "../brain/grove.ts";
import type { Decision } from "../brain/types.ts";
import { toChatMessage } from "../discord/adapt.ts";
import { logger } from "../logger.ts";

const log = logger("chat");

const asset = (name: string) => fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));

interface Pending {
  messageId: string;
  cancelled: boolean;
  timer: ReturnType<typeof setTimeout>;
}

// Connects Grove's brain to Discord: every message is shown to the brain, and
// its decisions become typing, replies and reactions.
export class GroveChat {
  private readonly grove: Grove;
  private readonly client: Client;
  private readonly pending = new Map<string, Pending>();

  constructor(grove: Grove, client: Client) {
    this.grove = grove;
    this.client = client;
  }

  observe(message: Message): void {
    this.grove.observe(toChatMessage(message, this.client.user?.id ?? null));
  }

  respond(message: Message): void {
    const chat = toChatMessage(message, this.client.user?.id ?? null);
    const decision = this.grove.consider(chat);
    if (decision === null) return;

    // Someone typed a follow-up before Grove answered: the brain has already
    // read both messages together, so the newer answer replaces the older one.
    const key = `${chat.channelId}:${chat.authorId}`;
    const previous = this.pending.get(key);
    if (previous !== undefined) {
      previous.cancelled = true;
      clearTimeout(previous.timer);
    }

    const entry: Pending = {
      messageId: message.id,
      cancelled: false,
      timer: setTimeout(() => {
        this.deliver(message, decision, entry).catch(error => log.error("could not answer", error));
      }, decision.waitForSilenceMs),
    };
    this.pending.set(key, entry);
  }

  private async deliver(message: Message, decision: Decision, entry: Pending): Promise<void> {
    if (entry.cancelled) return;
    if (decision.waitForSilenceMs > 0 && !this.grove.stillUnanswered(message.id)) return;

    if (decision.text !== null && message.channel.isSendable()) {
      await message.channel.sendTyping().catch(() => undefined);
    }
    await sleep(decision.delayMs);
    if (entry.cancelled) return;
    this.release(message, entry);

    let sentId: string | null = null;
    if (decision.text !== null) {
      const sent = await message.reply({
        content: decision.text,
        files: decision.files.map(name => new AttachmentBuilder(asset(name), { name })),
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: false,
      });
      sentId = sent.id;
    }
    for (const reaction of decision.reactions) {
      await message.react(reaction).catch(error => log.warn(`could not react with ${reaction}`, error));
    }

    this.grove.didSay(decision, sentId, Date.now());
    log.info(`${decision.meta.act} -> ${decision.meta.toUserName} in ${message.channelId}${decision.meta.topic ? ` (${decision.meta.topic})` : ""}`);
  }

  private release(message: Message, entry: Pending): void {
    const key = `${message.channelId}:${message.author.id}`;
    if (this.pending.get(key) === entry) this.pending.delete(key);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
