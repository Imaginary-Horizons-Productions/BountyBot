const { createSubcommandMappings, bountiesToSelectOptions, trimForModalTitle, trimForSelectOptionDescription, generateBountyBoardThread, updatePosting, updateScoreboard } = require("./dAPIRequests");
const { commandMention, congratulationBuilder, generateTextBar, getNumberEmoji, listifyEN, ihpAuthorPayload, randomFooterTip, buildVersionEmbed, buildBountyEmbed, generateBountyBoardButtons, generateBountyRewardString, sendAnnouncement, buildCompanyLevelUpLine, seasonalScoreboardEmbed, overallScoreboardEmbed, statsEmbed, getHunterLevelUpRewards, buildHunterLevelUpLine, modStatsEmbed, generateToastEmbed, generateSecondingActionRow, generateToastRewardString, generateCompletionEmbed, generateSecondingRewardString } = require("./messageParts");
const { getRankUpdates } = require("./toBeMoved");
const { textsHaveAutoModInfraction } = require("./validations");

module.exports = {
	generateBountyBoardThread,
	createSubcommandMappings,
	bountiesToSelectOptions,
	trimForModalTitle,
	trimForSelectOptionDescription,
	ihpAuthorPayload,
	randomFooterTip,
	buildBountyEmbed,
	buildVersionEmbed,
	generateBountyRewardString,
	generateBountyBoardButtons,
	commandMention,
	congratulationBuilder,
	generateTextBar,
	getNumberEmoji,
	listifyEN,
	sendAnnouncement,
	buildCompanyLevelUpLine,
	seasonalScoreboardEmbed,
	overallScoreboardEmbed,
	statsEmbed,
	getHunterLevelUpRewards,
	buildHunterLevelUpLine,
	modStatsEmbed,
	generateToastEmbed,
	generateSecondingActionRow,
	generateToastRewardString,
	generateCompletionEmbed,
	generateSecondingRewardString,
	textsHaveAutoModInfraction,
	updatePosting,
	updateScoreboard,
	getRankUpdates
};
