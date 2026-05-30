export type MemberOf<T> = T[keyof T];

export type CooldownDictionary = Record<string, number>;

export type PremiumFlowList = string[];

export type LogicLayer = typeof import("../logic");
