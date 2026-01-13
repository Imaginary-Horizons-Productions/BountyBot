const { SelectMenuLimits, MessageLimits } = require("@sapphire/discord.js-utilities");
const { truncateTextToLength } = require("./messageParts");
const { Bounty, Rank } = require("../../database/models");
const { Role, Collection, AttachmentBuilder, ActionRowBuilder, UserSelectMenuBuilder } = require("discord.js");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { emojiFromNumber } = require("./stringConstructors");

/** @file Discord API (dAPI) Serializers - changes our data into the shapes dAPI wants */

//#region Serialization Utilities - modifies a given entity
// Naming Convention: describe modifications, don't match other conventions

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

/** Checks if the given `content` fits in a Discord message and attaches it as a file if it doesn't
 * @param {string} content
 * @param {import("discord.js").BaseMessageOptionsWithPoll} messageOptions
 * @param {string} filename
 */
function attachOverflowingContentAsFile(content, messageOptions, filename) {
	if (content.length < MessageLimits.MaximumLength) {
		messageOptions.content = content;
	} else {
		messageOptions.files = [new AttachmentBuilder(Buffer.from(content, 'utf16le'), { name: filename })];
	}
	return messageOptions;
}
//#endregion

//#region Serializers - returns whole entities
// Naming Convention: `${outputType}From${inputType}`

/** @param {string} placeholderText */
function disabledSelectRow(placeholderText) {
	return new ActionRowBuilder().addComponents(
		new UserSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
			.setPlaceholder(truncateTextToLength(placeholderText, SelectMenuLimits.MaximumPlaceholderCharacters))
			.setDisabled(true)
	)
}

/** @param {Bounty[]} bounties */
function selectOptionsFromBounties(bounties) {
	return bounties.map(bounty => {
		const optionPayload = {
			emoji: emojiFromNumber(bounty.slotNumber),
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
//#endregion

module.exports = {
	truncateTextToLength,
	attachOverflowingContentAsFile,
	disabledSelectRow,
	selectOptionsFromBounties,
	selectOptionsFromRanks
}
