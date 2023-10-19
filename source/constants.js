exports.authPath = "../config/auth.json";
const { testGuildId, feedbackChannelId } = require(exports.authPath);
const { announcementsChannelId, lastPostedVersion } = require("../config/versionData.json");

module.exports = {
	// Conversion Factors
	DAY_IN_MS: 86400000,
	YEAR_IN_MS: 31556926000,

	// JS Constants
	MAX_SET_TIMEOUT: 2 ** 31 - 1,

	// Discord Constants
	MAX_EMBED_TITLE_LENGTH: 256,

	// Config
	testGuildId,
	feedbackChannelId,
	announcementsChannelId,
	lastPostedVersion,

	// Internal Constants
	SAFE_DELIMITER: "→",
	COMPANY_XP_COEFFICIENT: 3,
	GLOBAL_MAX_BOUNTY_SLOTS: 10
};
