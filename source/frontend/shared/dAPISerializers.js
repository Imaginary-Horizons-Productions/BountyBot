const { SelectMenuLimits, MessageLimits, EmbedLimits } = require("@sapphire/discord.js-utilities");
const { truncateTextToLength } = require("./messageParts");
const { Bounty, Rank, Company } = require("../../database/models");
const { Role, Collection, AttachmentBuilder, ActionRowBuilder, UserSelectMenuBuilder, userMention, EmbedBuilder, Guild } = require("discord.js");
const { SKIP_INTERACTION_HANDLING, bountyBotIconURL, discordIconURL } = require("../../constants");
const { emojiFromNumber, sentenceListEN } = require("./stringConstructors");

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

/** @type {import("discord.js").EmbedFooterData[]} */
const discordTips = [
	"Message starting with @silent don't send notifications; good for when everyone's asleep.",
	"Surround your message with || to mark it a spoiler (not shown until reader clicks on it).",
	"Surround a part of your messag with ~~ to add strikethrough styling.",
	"Don't forget to check slash commands for optional arguments.",
	"Some slash commands can be used in DMs, others can't.",
	"Server subscriptions cost more on mobile because the mobile app stores take a cut."
].map(text => ({ text, iconURL: discordIconURL }));
/** @type {import("discord.js").EmbedFooterData[]} */
const bountyBotTips = [
	"You can showcase one of your bounties once a week to increase its rewards.",
	"Send bug reports or feature requests with the \"/feedback\".",
	"Bounties can't be completed until 5 minutes after they've been posted. Don't make them too easy!",
	"You get XP for posting a bounty, but lose that XP if it's taken down before it's completed.",
	"You get XP when your bounties are completed. Thanks for posting!",
	"You get more XP when a bigger group completes your bounties. Thanks for organizing!",
	"Sometimes when you raise a toast to someone, it'll crit and grant you XP too!",
	"Your chance for Critical Toast is lower when repeatedly toasting the same bounty hunters. Spread the love!",
	"Users who can manage BountyBot aren't included in seasonal rewards to avoid conflicts of interest.",
	"Anyone can post a bounty, even you!",
	"Anyone can raise a toast, even you!",
	"The Overjustification Effect means a small reward can be less motivating than no reward.",
	"Manage bounties from within games with the Discord Overlay (default: Shift + Tab)!",
	"Server level is based on total bounty hunter level--higher server level means better evergreen bounty rewards.",
	"A bounty poster cannot complete their own bounty.",
	"Adding a description, image or time to a bounty all add 1 bonus XP for the poster.",
	"Bounty posters have double the chance to find items compared to completers."
].map(text => ({ text, iconURL: bountyBotIconURL }));
const tipPool = bountyBotTips.concat(bountyBotTips, discordTips);

/** twice as likely to roll an application specific tip as a discord tip */
function randomFooterTip() {
	return tipPool[Math.floor(Math.random() * tipPool.length)];
}

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

/** Generate an embed for the given bounty
 * @param {Bounty} bounty
 * @param {Guild} guild
 * @param {number} posterLevel
 * @param {boolean} shouldOmitRewardsField
 * @param {Company} company
 * @param {Set<string>} hunterIdSet
 */
async function bountyEmbed(bounty, guild, posterLevel, shouldOmitRewardsField, company, hunterIdSet) {
	const author = await guild.members.fetch(bounty.userId);
	const fields = [];
	const embed = new EmbedBuilder().setColor(author.displayColor)
		.setThumbnail(bounty.thumbnailURL ?? company[`${bounty.state}BountyThumbnailURL`])
		.setTitle(bounty.state == "complete" ? `Bounty Complete! ${bounty.title}` : bounty.title)
		.setTimestamp();
	if (bounty.description) {
		embed.setDescription(bounty.description);
	}
	if (bounty.attachmentURL) {
		embed.setImage(bounty.attachmentURL);
	}
	if (bounty.scheduledEventId) {
		const event = await guild.scheduledEvents.fetch(bounty.scheduledEventId);
		fields.push({ name: "Time", value: `${discordTimestamp(event.scheduledStartTimestamp / 1000)} - ${discordTimestamp(event.scheduledEndTimestamp / 1000)}` });
	}
	if (!shouldOmitRewardsField) {
		fields.push({ name: "Reward", value: `${Bounty.calculateCompleterReward(posterLevel, bounty.slotNumber, bounty.showcaseCount)} XP${company.festivalMultiplierString()}`, inline: true });
	}

	if (bounty.isEvergreen) {
		embed.setAuthor({ name: `Evergreen Bounty #${bounty.slotNumber}`, iconURL: author.user.displayAvatarURL() });
	} else {
		embed.setAuthor({ name: `${author.displayName}'s #${bounty.slotNumber} Bounty`, iconURL: author.user.displayAvatarURL() });
	}
	if (hunterIdSet.size > 0) {
		const completersFieldText = sentenceListEN(Array.from(hunterIdSet.values().map(id => userMention(id))));
		if (completersFieldText.length <= EmbedLimits.MaximumFieldValueLength) {
			fields.push({ name: "Turned in by:", value: completersFieldText });
		} else {
			fields.push({ name: "Turned in by:", value: "Too many to display!" });
		}
	}

	if (fields.length > 0) {
		embed.addFields(fields);
	}
	return embed;
}
//#endregion

module.exports = {
	truncateTextToLength,
	attachOverflowingContentAsFile,
	randomFooterTip,
	disabledSelectRow,
	selectOptionsFromBounties,
	selectOptionsFromRanks,
	bountyEmbed
}
