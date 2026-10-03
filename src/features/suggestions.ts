import type { AnyThreadChannel } from "discord.js";
import { CHANNELS, FORUM_TAGS } from "../config.ts";
import { logger } from "../logger.ts";

const log = logger("suggestions");

// Every new suggestion post starts out tagged "Pending Review".
export async function tagNewSuggestion(thread: AnyThreadChannel, newlyCreated: boolean): Promise<void> {
  if (!newlyCreated || thread.parentId !== CHANNELS.suggestions) return;
  if (thread.appliedTags.includes(FORUM_TAGS.pendingReview)) return;

  try {
    await thread.setAppliedTags([...thread.appliedTags, FORUM_TAGS.pendingReview], "Automatically applied Pending Review tag");
    log.info(`tagged new suggestion: ${thread.name}`);
  } catch (error) {
    log.error(`could not tag ${thread.name}`, error);
  }
}
