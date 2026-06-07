import type { Sequelize } from "sequelize";
import { initModel as initBountyModel } from "./models/Bounty.ts";
import { initModel as initCompanyModel } from "./models/Company.ts";
import { initModel as initCompletionModel } from "./models/Completion.ts";
import { initModel as initContributionModel } from "./models/Contribution.ts";
import { initModel as initGoalModel } from "./models/Goal.ts";
import { initModel as initHunterModel } from "./models/Hunter.ts";
import { initModel as initItemModel } from "./models/Item.ts";
import { initModel as initParticipationModel } from "./models/Participation.ts";
import { initModel as initRankModel } from "./models/Rank.ts";
import { initModel as initRecipientModel } from "./models/Recipient.ts";
import { initModel as initSeasonModel } from "./models/Season.ts";
import { initModel as initSecondingModel } from "./models/Seconding.ts";
import { initModel as initToastModel } from "./models/Toast.ts";
import { initModel as initUserModel } from "./models/User.ts";
import { initModel as initUserInteractionModel } from "./models/UserInteraction.ts";

export type Database = ReturnType<typeof initDB>;

export function initDB(connection: Sequelize) {
	return {
		Bounties: initBountyModel(connection),
		Completions: initCompletionModel(connection),
		Companies: initCompanyModel(connection),
		Contributions: initContributionModel(connection),
		Goals: initGoalModel(connection),
		Ranks: initRankModel(connection),
		Participations: initParticipationModel(connection),
		Seasons: initSeasonModel(connection),
		Recipients: initRecipientModel(connection),
		Secondings: initSecondingModel(connection),
		Toasts: initToastModel(connection),
		Hunters: initHunterModel(connection),
		Items: initItemModel(connection),
		Users: initUserModel(connection),
		UserInteractions: initUserInteractionModel(connection)
	}
}

export * as DatabaseTypes from "./models/_types.ts";
