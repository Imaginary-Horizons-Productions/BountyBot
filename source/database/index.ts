import { Sequelize } from "sequelize";
import { initModel as initBountyModel } from "./models/Bounty.js";
import { initModel as initCompanyModel } from "./models/Company.ts";
import { initModel as initCompletionModel } from "./models/Completion.js";
import { initModel as initContributionModel } from "./models/Contribution.js";
import { initModel as initGoalModel } from "./models/Goal.js";
import { initModel as initHunterModel } from "./models/Hunter.js";
import { initModel as initItemModel } from "./models/Item.js";
import { initModel as initParticipationModel } from "./models/Participation.js";
import { initModel as initRankModel } from "./models/Rank.js";
import { initModel as initRecipientModel } from "./models/Recipient.js";
import { initModel as initSeasonModel } from "./models/Season.js";
import { initModel as initSecondingModel } from "./models/Seconding.js";
import { initModel as initToastModel } from "./models/Toast.js";
import { initModel as initUserModel } from "./models/User.js";
import { initModel as initUserInteractionModel } from "./models/UserInteraction.js";

//TODONOW get real db connection
let sequelize: Sequelize = new Sequelize();

const TABLE_DICTIONARY = {
	Bounties: initBountyModel(sequelize),
	Completions: initCompletionModel(sequelize),
	Companies: initCompanyModel(sequelize),
	Contributions: initContributionModel(sequelize),
	Goals: initGoalModel(sequelize),
	Ranks: initRankModel(sequelize),
	Participations: initParticipationModel(sequelize),
	Seasons: initSeasonModel(sequelize),
	Recipients: initRecipientModel(sequelize),
	Secondings: initSecondingModel(sequelize),
	Toasts: initToastModel(sequelize),
	Hunters: initHunterModel(sequelize),
	Items: initItemModel(sequelize),
	Users: initUserModel(sequelize),
	UserInteractions: initUserInteractionModel(sequelize)
};

export * as DatabaseTypes from "./models/_types.ts";
export type Database = typeof TABLE_DICTIONARY;
export default TABLE_DICTIONARY;
