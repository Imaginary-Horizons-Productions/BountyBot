export type LogicLayer = typeof LOGIC_LAYER;

export const LOGIC_LAYER = {
	bounties: await import("./bounties"),
	companies: await import("./companies"),
	goals: await import("./goals"),
	hunters: await import("./hunters"),
	ranks: await import("./ranks"),
	items: await import("./items"),
	seasons: await import("./seasons"),
	toasts: await import("./toasts"),
	cooldowns: await import("./cooldowns")
};
