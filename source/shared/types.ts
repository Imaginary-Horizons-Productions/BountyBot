import { Snowflake } from "discord.js";

export type MemberOf<T> = T[keyof T];

export type CooldownDictionary = Record<string, number>;

export type PremiumFlowList = string[];

export type CompanyReciept = Partial<{ guildName: string; levelUp: number; gp: number; gpMultiplier: string; }>;

export type HunterReceipt = Partial<{ title: "Critical Toast!" | "Bounty Poster"; rankUp: { name: string; newRankIndex: number; }; topPlacement: boolean; xp: number; xpMultiplier: string; levelUp: { achievedLevel: number, previousLevel: number }; item: string; }>;

export type HunterReceiptMap = Map<Snowflake, HunterReceipt>;

export const GoalProgressKind = {
	Bounty: "bounties",
	Toast: "toasts",
	Seconding: "secondings"
} as const;

export type GoalProgressKind = MemberOf<typeof GoalProgressKind>;
