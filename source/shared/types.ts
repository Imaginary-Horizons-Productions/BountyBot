export type MemberOf<T> = T[keyof T];

export type CooldownDictionary = Record<string, number>;

export type PremiumFlowList = string[];

export const RunModeKind = {
	Development: "development",
	Test: "test",
	Production: "production"
} as const;

export type RunModeKindMember = MemberOf<typeof RunModeKind>;

export function isRunModeKindMember(text: string): text is RunModeKindMember {
	return Object.values(RunModeKind).some(runMode => runMode === text);
}
