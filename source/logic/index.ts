export type LogicLayer = typeof LOGIC_LAYER;

export const LOGIC_LAYER = {
	bounties: await import("./bounties.ts"),
	companies: await import("./companies.ts"),
	goals: await import("./goals.ts"),
	hunters: await import("./hunters.ts"),
	ranks: await import("./ranks.ts"),
	items: await import("./items.ts"),
	seasons: await import("./seasons.ts"),
	toasts: await import("./toasts.ts"),
	cooldowns: await import("./cooldowns.ts")
};
