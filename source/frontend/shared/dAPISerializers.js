const { SelectMenuLimits } = require("@sapphire/discord.js-utilities");
const { truncateTextToLength, getNumberEmoji } = require("./messageParts");
const { Bounty, Rank } = require("../../database/models");
const { Role, Collection } = require("discord.js");

/**
 * @file Discord API (dAPI) Serializers - changes our data into the shapes dAPI wants
 *
 * Naming conventions:
 * - Serializer: `${outputType}From${inputType}`
 */

/**
 * @param {string} text
 * @param {number} length
 */
function truncateTextToLength(text, length) {
	if (text.length > length) {
		return `${text.slice(0, length - 1)}…`;
	} else {
		return text;
	}
}

/** @param {Bounty[]} bounties */
function selectOptionsFromBounties(bounties) {
	return bounties.map(bounty => {
		const optionPayload = {
			emoji: getNumberEmoji(bounty.slotNumber),
			label: bounty.title,
			value: bounty.id
		}
		if (bounty.description) {
			optionPayload.description = truncateTextToLength(bounty.description, SelectMenuLimits.MaximumLengthOfDescriptionOfOption);
		}
		return optionPayload;
	}).slice(0, SelectMenuLimits.MaximumOptionsLength);
}

/**
 * @param {Rank[]} ranks
 * @param {Collection<string, Role>} allGuildRoles
 */
function selectOptionsFromRanks(ranks, allGuildRoles) {
	return ranks.map((rank, index) => {
		const option = {
			label: rank.roleId ? allGuildRoles.get(rank.roleId).name : `Rank ${index + 1}`,
			description: `Variance Threshold: ${rank.threshold}`,
			value: rank.threshold.toString()
		};
		if (rank.rankmoji) {
			option.emoji = rank.rankmoji;
		}
		return option;
	}).slice(0, SelectMenuLimits.MaximumOptionsLength);
}

module.exports = {
	truncateTextToLength,
	selectOptionsFromBounties,
	selectOptionsFromRanks
}
