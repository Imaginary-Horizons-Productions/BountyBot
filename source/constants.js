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
	discordIconURL: "https://cdn.discordapp.com/attachments/618523876187570187/1110265047516721333/discord-mark-blue.png",

	// Config
	authPath,
	testGuildId,
	feedbackChannelId,
	announcementsChannelId,
	lastPostedVersion,
	premium: require("../config/premium.json"),
	commandIds: {},

	// Internal Constants
	bountyBotIconURL: "https://cdn.discordapp.com/attachments/618523876187570187/1138968614364528791/BountyBotIcon.jpg",
	BOUNTYBOT_INVITE_URL: "https://discord.com/oauth2/authorize?client_id=536330483852771348&permissions=2269727342913536&integration_type=0&scope=bot",
	SAFE_DELIMITER: "→",
	SKIP_INTERACTION_HANDLING: "❌",
	COMPANY_XP_COEFFICIENT: 3,
	GLOBAL_MAX_BOUNTY_SLOTS: MessageLimits.MaximumEmbeds,
	MAX_EVERGREEN_SLOTS: MessageLimits.MaximumEmbeds,
	GLOBAL_COMMAND_COOLDOWN: 2000 // in ms
};
