const { EmbedBuilder, Colors, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle, heading, userMention, bold, italic, GuildMember, Role, Collection, GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType, unorderedList, TextInputBuilder, TextInputStyle, ModalBuilder, LabelBuilder } = require("discord.js");
const { MessageLimits, ModalLimits } = require("@sapphire/discord.js-utilities");
const { SAFE_DELIMITER, YEAR_IN_MS, SKIP_INTERACTION_HANDLING } = require("../../constants");
const { Bounty, Completion, Company, Rank, Hunter } = require("../../database/models");
const { discordTimestamp, timeConversion } = require("../../shared");

/**
 * @param {Record<string, { newPlacement: number } | { newRankIndex: number | null, rankIncreased: boolean }>} seasonResults
 * @param {Rank[]} descendingRanks
 * @param {Collection<string, Role>} allGuildRoles
 */
function formatSeasonResultsToRewardTexts(seasonResults, descendingRanks, allGuildRoles) {
	/** @type {string[]} */
	const rewardTexts = [];
	for (const id in seasonResults) {
		const result = seasonResults[id];
		if (result.newPlacement === 1) {
			rewardTexts.push(italic(`${userMention(id)} has reached the #1 spot for this season!`));
		}
		if (result.rankIncreased) {
			const rank = descendingRanks[result.newRankIndex];
			const rankName = rank.roleId ? allGuildRoles.get(rank.roleId).name : `Rank ${result.newRankIndex + 1}`;
			rewardTexts.push(`${randomCongratulatoryPhrase()}, ${userMention(id)}! You've risen to ${bold(rankName)}!`);
		}
	}
	return rewardTexts;
}

/**
 * @param {number?} startTimestamp Unix timestamp (seconds since Jan 1 1970)
 * @param {number?} endTimestamp Unix timestamp (seconds since Jan 1 1970)
 */
function validateScheduledEventTimestamps(startTimestamp, endTimestamp) {
	const errors = [];
	const nowTimestamp = Date.now() / 1000;

	if (!startTimestamp) {
		errors.push(`Start Timestamp must be an integer. Received: ${startTimestamp}`);
	}

	if (nowTimestamp >= startTimestamp || startTimestamp >= nowTimestamp + (5 * YEAR_IN_MS)) {
		errors.push(`Start Timestamp must be between now and 5 years in the future. Received: ${startTimestamp}, which computes to ${discordTimestamp(startTimestamp)}`);
	}

	if (!endTimestamp) {
		errors.push(`End Timestamp must be an integer. Received: ${endTimestamp}`);
	}

	if (nowTimestamp >= endTimestamp || endTimestamp >= nowTimestamp + (5 * YEAR_IN_MS)) {
		errors.push(`End Timestamp must be between now and 5 years in the future. Received: ${endTimestamp}, which computes to ${discordTimestamp(endTimestamp)}`);
	}

	if (startTimestamp > endTimestamp) {
		errors.push(`End Timestamp (${discordTimestamp(endTimestamp)}) was before Start Timestamp (${discordTimestamp(startTimestamp)}).`);
	}
	return errors;
}

/**
 * @param {string} title
 * @param {string} posterName
 * @param {number} slotNumber
 * @param {string?} description
 * @param {string?} imageURL
 * @param {number?} startTimestamp Unix timestamp (seconds since Jan 1 1970)
 * @param {number?} endTimestamp Unix timestamp (seconds since Jan 1 1970)
 */
function createBountyEventPayload(title, posterName, slotNumber, description, imageURL, startTimestamp, endTimestamp) {
	const payload = {
		name: `Bounty: ${title}`,
		scheduledStartTime: startTimestamp * 1000,
		scheduledEndTime: endTimestamp * 1000,
		privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
		entityType: GuildScheduledEventEntityType.External,
		entityMetadata: { location: `${posterName}'s #${slotNumber} Bounty` }
	};
	if (description) {
		payload.description = description;
	}
	if (imageURL) {
		payload.image = imageURL;
	}
	return payload;
}

/**
 * @param {Bounty} bounty
 * @param {boolean} isEvergreen
 * @param {string} key for constructing the ModalBuilder's customId uniquely
 * @param {Guild} guild
 */
async function constructEditBountyModalAndOptions(bounty, isEvergreen, key, guild) {
	const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}${key}`)
		.setTitle(truncateTextToLength(`Edit Bounty: ${bounty.title}`, ModalLimits.MaximumTitleCharacters))
		.addLabelComponents(
			new LabelBuilder().setLabel("Title")
				.setTextInputComponent(
					new TextInputBuilder().setCustomId("title")
						.setRequired(false)
						.setStyle(TextInputStyle.Short)
						.setPlaceholder("Discord markdown allowed...")
						.setValue(bounty.title)
				),
			new LabelBuilder().setLabel("Description")
				.setTextInputComponent(
					new TextInputBuilder().setCustomId("description")
						.setRequired(false)
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder(isEvergreen ? "Bounties with clear instructions are easier to complete..." : "Get a 1 XP bonus on completion for the following: description, image URL, timestamps")
						.setValue(bounty.description ?? "")
				),
			new LabelBuilder().setLabel("Image URL")
				.setTextInputComponent(
					new TextInputBuilder().setCustomId("imageURL")
						.setRequired(false)
						.setStyle(TextInputStyle.Short)
						.setValue(bounty.attachmentURL ?? "")
				)
		);
	if (!isEvergreen) {
		const eventStartComponent = new TextInputBuilder().setCustomId("startTimestamp")
			.setRequired(false)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder("Required if making an event with the bounty");
		const eventEndComponent = new TextInputBuilder().setCustomId("endTimestamp")
			.setRequired(false)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder("Required if making an event with the bounty");

		if (bounty.scheduledEventId) {
			const scheduledEvent = await guild.scheduledEvents.fetch(bounty.scheduledEventId);
			eventStartComponent.setValue((scheduledEvent.scheduledStartTimestamp / 1000).toString());
			eventEndComponent.setValue((scheduledEvent.scheduledEndTimestamp / 1000).toString());
		}
		modal.addLabelComponents(
			new LabelBuilder().setLabel("Event Start (Unix Timestamp)")
				.setTextInputComponent(eventStartComponent),
			new LabelBuilder().setLabel("Event End (Unix Timestamp)")
				.setTextInputComponent(eventEndComponent)
		)
	}
	return { modal, submissionOptions: { filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") } };
}

module.exports = {
	rewardTextsHunterResults,
	formatSeasonResultsToRewardTexts,
	validateScheduledEventTimestamps,
	createBountyEventPayload,
	constructEditBountyModalAndOptions
};
