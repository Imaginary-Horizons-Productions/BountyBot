import type { Options } from "sequelize";
import type { MemberOf } from "../types";

export const RunMode = {
	Development: "development",
	Test: "test",
	Production: "production"
} as const;

export type RunMode = MemberOf<typeof RunMode>;

export class DatabaseOptionsDictionary {
	declare [RunMode.Development]: Options;
	declare [RunMode.Test]: Options;
	declare [RunMode.Production]: Options;

	constructor(importedFile: Record<RunMode, {}>) {
		this[RunMode.Development] = importedFile[RunMode.Development];
		this[RunMode.Test] = importedFile[RunMode.Test];
		this[RunMode.Production] = importedFile[RunMode.Production];
	}
}
