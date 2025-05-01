const authPath = "../config/auth.json";
const { testGuildId, feedbackChannelId } = require(authPath);
const { announcementsChannelId, lastPostedVersion } = require("../config/versionData.json");

module.exports = {
	// Conversion Factors
	YEAR_IN_MS: 31556926000,
	ZERO_WIDTH_WHITE_SPACE: "\u200B",

	// JS Constants
	MAX_SET_TIMEOUT: 2 ** 31 - 1,

	// Discord Constants
	serverGuideMention: "<id:guide>",
	channelBrowserMention: "<id:customize>",

	// Config
	authPath,
	testGuildId,
	feedbackChannelId,
	announcementsChannelId,
	lastPostedVersion,
	premium: require("../config/premium.json"),
	commandIds: {},

	// Internal Constants
	BOUNTYBOT_INVITE_URL: "https://discord.com/api/oauth2/authorize?client_id=536330483852771348&permissions=18135835404336&scope=bot%20applications.commands",
	SAFE_DELIMITER: "→",
	SKIP_INTERACTION_HANDLING: "❌",
	COMPANY_XP_COEFFICIENT: 3,
	GLOBAL_MAX_BOUNTY_SLOTS: 10
};
