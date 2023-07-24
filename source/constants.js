exports.SAFE_DELIMITER = "→";
exports.MAX_SET_TIMEOUT = 2 ** 31 - 1;
exports.DAY_IN_MS = 86400000;
exports.YEAR_IN_MS = 31556926000;

exports.authPath = "../config/auth.json";
const { testGuildId, feedbackChannelId } = require(exports.authPath);
exports.testGuildId = testGuildId;
exports.feedbackChannelId = feedbackChannelId;

const { announcementsChannelId, lastPostedVersion } = require("../config/versionData.json");
exports.announcementsChannelId = announcementsChannelId;
exports.lastPostedVersion = lastPostedVersion;

exports.MAX_EMBED_TITLE_LENGTH = 256;

exports.GUILD_XP_COEFFICIENT = 3;
