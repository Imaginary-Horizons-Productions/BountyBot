const { SelectMenuLimits } = require("@sapphire/discord.js-utilities");
const { truncateTextToLength, getNumberEmoji } = require("./messageParts");
const { Bounty } = require("../../database/models");

/**
 * @file Discord API (dAPI) Serializers - changes our data into the shapes dAPI wants
 *
 * Naming conventions:
 * - Serializer: `${outputType}From${inputType}`
 */

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

module.exports = {
	selectOptionsFromBounties
}
