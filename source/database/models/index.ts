import { initModel as initBountyModel } from "./bounties/Bounty";
import { initModel as initCompletionModel } from "./bounties/Completion";
import { initModel as initCompanyModel } from "./companies/Company.ts";
import { initModel as initContributionModel } from "./companies/Contribution";
import { initModel as initGoalModel } from "./companies/Goal";
import { initModel as initRankModel } from "./companies/Rank";
import { initModel as initParticipationModel } from "./seasons/Participation";
import { initModel as initSeasonModel } from "./seasons/Season";
import { initModel as initRecipientModel } from "./toasts/Recipient";
import { initModel as initSecondingModel } from "./toasts/Seconding";
import { initModel as initToastModel } from "./toasts/Toast";
import { initModel as initHunterModel } from "./users/Hunter";
import { initModel as initItemModel } from "./users/Item";
import { initModel as initUserModel } from "./users/User";
import { initModel as initUserInteractionModel } from "./users/UserInteraction.js";

export default {
	Bounty: initBountyModel(),
	Completion: initCompletionModel(),
	Company: initCompanyModel(),
	Contribution: initContributionModel(),
	Goal: initGoalModel(),
	Rank: initRankModel(),
	Participation: initParticipationModel(),
	Season: initSeasonModel(),
	Recipient: initRecipientModel(),
	Seconding: initSecondingModel(),
	Toast: initToastModel(),
	Hunter: initHunterModel(),
	Item: initItemModel(),
	User: initUserModel(),
	UserInteraction: initUserInteractionModel()
};
