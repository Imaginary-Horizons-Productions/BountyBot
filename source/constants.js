const authPath = "../config/auth.json";
const { testGuildId, feedbackChannelId } = require(authPath);
const { announcementsChannelId, lastPostedVersion } = require("../config/versionData.json");

module.exports = {
	// Conversion Factors
	DAY_IN_MS: 86400000,
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

	// Config
	authPath,
	testGuildId,
	feedbackChannelId,
	announcementsChannelId,
	lastPostedVersion,
	premium: require("../config/premium.json"),

	// Internal Constants
	SAFE_DELIMITER: "→",
	COMPANY_XP_COEFFICIENT: 3,
	GLOBAL_MAX_BOUNTY_SLOTS: 10
};
