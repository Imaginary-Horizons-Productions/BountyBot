import type { Snowflake } from "discord.js";

export type MemberOf<T> = T[keyof T];

export type MakePropertiesNonNullable<Type, Keys extends keyof Type> = Type & { [K in keyof Type]: K extends Keys ? NonNullable<Type[K]> : Type[K] };

export function isNotNull<T>(candidate: T | null): candidate is T {
	return candidate !== null;
}

export type CooldownDictionary = Record<string, number>;

export type PremiumFlowList = string[];

export type CompanyReciept = Partial<{ guildName: string; levelUp: number; gp: number; gpMultiplier: string; }>;

export type HunterReceipt = Partial<{ title: "Critical Toast!" | "Bounty Poster"; rankUp: { name: string; newRankIndex: number; }; topPlacement: boolean; xp: number; xpMultiplier: string; levelUp: { achievedLevel: number, previousLevel: number }; item: string; }>;

export type HunterReceiptMap = Map<Snowflake, HunterReceipt>;

export const BountyState = {
	Open: "open",
	Completed: "completed",
	Deleted: "deleted"
} as const;

export type BountyState = MemberOf<typeof BountyState>;

export const CompanyAnnouncementPrefix = {
	Online: "@here",
	Everyone: "@everyone",
	Silent: "@silent",
	None: ""
} as const;

export type CompanyAnnouncementPrefix = MemberOf<typeof CompanyAnnouncementPrefix>;

export function isCompanyAnnouncementPrefix(candidate: string): candidate is CompanyAnnouncementPrefix {
	return Object.values(CompanyAnnouncementPrefix).some(value => value === candidate);
}

export const GoalState = {
	Ongoing: "ongoing",
	Expired: "expired",
	Completed: "completed"
} as const;

export type GoalState = MemberOf<typeof GoalState>;

export const GoalProgressKind = {
	Bounty: "bounties",
	Toast: "toasts",
	Seconding: "secondings"
} as const;

export type GoalProgressKind = MemberOf<typeof GoalProgressKind>;
