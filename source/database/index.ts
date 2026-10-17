import type { Sequelize } from "sequelize";
import * as Bounty from "./models/Bounty.ts";
import * as Company from "./models/Company.ts";
import * as Completion from "./models/Completion.ts";
import * as Contribution from "./models/Contribution.ts";
import * as Goal from "./models/Goal.ts";
import * as Hunter from "./models/Hunter.ts";
import * as Item from "./models/Item.ts";
import * as Participation from "./models/Participation.ts";
import * as Rank from "./models/Rank.ts";
import * as Recipient from "./models/Recipient.ts";
import * as Season from "./models/Season.ts";
import * as Seconding from "./models/Seconding.ts";
import * as Toast from "./models/Toast.ts";
import * as User from "./models/User.ts";
import * as UserInteraction from "./models/UserInteraction.ts";

export type Database = ReturnType<typeof initDB>;

export function initDB(connection: Sequelize) {
	const db = {
		Bounties: Bounty.initModel(connection),
		Companies: Company.initModel(connection),
		Completions: Completion.initModel(connection),
		Contributions: Contribution.initModel(connection),
		Goals: Goal.initModel(connection),
		Hunters: Hunter.initModel(connection),
		Items: Item.initModel(connection),
		Participations: Participation.initModel(connection),
		Ranks: Rank.initModel(connection),
		Recipients: Recipient.initModel(connection),
		Seasons: Season.initModel(connection),
		Secondings: Seconding.initModel(connection),
		Toasts: Toast.initModel(connection),
		Users: User.initModel(connection),
		UserInteractions: UserInteraction.initModel(connection)
	};
	for (const table of [
		Bounty,
		Company,
		Completion,
		Contribution,
		Goal,
		Hunter,
		Item,
		Participation,
		Rank,
		Recipient,
		Season,
		Seconding,
		Toast,
		User,
		UserInteraction
	]) {
		table.associate(db);
	}
	return db;
}

export * as DatabaseTypes from "./models/_types.ts";
