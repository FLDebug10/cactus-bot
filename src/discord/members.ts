import { type GuildMember, PermissionFlagsBits } from "discord.js";
import { STAFF_ROLE_IDS } from "../config.ts";

// Contributors and staff: anyone with a staff role, or with Manage Threads.
export function isStaff(member: GuildMember | null | undefined): boolean {
  if (member === null || member === undefined) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageThreads)) return true;
  return STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

export function canManageMessages(member: GuildMember | null | undefined): boolean {
  return member?.permissions.has(PermissionFlagsBits.ManageMessages) ?? false;
}
