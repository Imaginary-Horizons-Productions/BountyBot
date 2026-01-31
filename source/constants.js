const authPath = "../config/auth.json";
const { testGuildId, feedbackChannelId } = require(authPath);
const { MessageLimits } = require("@sapphire/discord.js-utilities");
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
	BOUNTYBOT_INVITE_URL: "https://discord.com/oauth2/authorize?client_id=536330483852771348&permissions=2269452465006624&integration_type=0&scope=bot",
	SAFE_DELIMITER: "→",
	SKIP_INTERACTION_HANDLING: "❌",
	COMPANY_XP_COEFFICIENT: 3,
	GLOBAL_MAX_BOUNTY_SLOTS: MessageLimits.MaximumEmbeds,
	MAX_EVERGREEN_SLOTS: MessageLimits.MaximumEmbeds,
	GLOBAL_COMMAND_COOLDOWN: 2000 // in ms
};
