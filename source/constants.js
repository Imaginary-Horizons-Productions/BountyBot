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
	MAX_MESSAGE_CONTENT_LENGTH: 2000,
	MAX_EMBED_AUTHOR_NAME_LENGTH: 256,
	MAX_EMBED_TITLE_LENGTH: 256,
	MAX_EMBED_DESCRIPTION_LENGTH: 4096,
	MAX_EMBED_FIELD_COUNT: 25,
	MAX_EMBED_FIELD_NAME_LENGTH: 256,
	MAX_EMBED_FIELD_VALUE_LENGTH: 1024,
	MAX_EMBED_FOOTER_LENGTH: 2048,
	MAX_EMBED_TOTAL_CHARACTERS: 6000,
	MAX_EMBEDS_PER_MESSAGE: 10,
	MAX_MESSAGE_ACTION_ROWS: 5,
	MAX_BUTTONS_PER_ROW: 5,
	MAX_SELECT_OPTIONS: 25,

	// Config
	authPath,
	testGuildId,
	feedbackChannelId,
	announcementsChannelId,
	lastPostedVersion,
	premium: require("../config/premium.json"),

	// Internal Constants
	BOUNTYBOT_INVITE_URL: "https://discord.com/api/oauth2/authorize?client_id=536330483852771348&permissions=18135835404336&scope=bot%20applications.commands",
	SAFE_DELIMITER: "→",
	SKIP_INTERACTION_HANDLING: "❌",
	COMPANY_XP_COEFFICIENT: 3,
	GLOBAL_MAX_BOUNTY_SLOTS: 10
};
