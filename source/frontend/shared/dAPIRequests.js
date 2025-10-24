const { CommandInteraction, GuildTextThreadManager, EmbedBuilder, Guild, ActionRowBuilder, Collection, Role, MessageFlags, Message, GuildMemberManager, ForumChannel, UserSelectMenuBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../classes");
const { Bounty, Company, Rank } = require("../../database/models");
const { getNumberEmoji, buildBountyEmbed } = require("./messageParts");
const { SelectMenuLimits, MessageLimits } = require("@sapphire/discord.js-utilities");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { ascendingByProperty } = require("../../shared");

/**
 * @param {string} mainId
 * @param {string[]} fileList
 */
function createSubcommandMappings(mainId, fileList) {
	const mappings = {
		/** @type {import("discord.js").BaseApplicationCommandData[]} */
		slashData: [],
		/** @type {Record<string, (interaction: CommandInteraction, runMode: string, ...args: [typeof import("../../logic"), unknown]) => Promise<void>>} */
		executeDictionary: {}
	};
	for (const fileName of fileList) {
		/** @type {SubcommandWrapper} */
		const subcommand = require(`../commands/${mainId}/${fileName}`);
		mappings.slashData.push(subcommand.data);
		mappings.executeDictionary[subcommand.data.name] = subcommand.executeSubcommand;
	};
	return mappings;
};

/** @param {Bounty[]} bounties */
function bountiesToSelectOptions(bounties) {
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
function rankArrayToSelectOptions(ranks, allGuildRoles) {
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
function contentOrFileMessagePayload(content, messageOptions, filename) {
	if (content.length < MessageLimits.MaximumLength) {
		messageOptions.content = content;
	} else {
		messageOptions.files = [new AttachmentBuilder(Buffer.from(content, 'utf16le'), { name: filename })];
	}
	return messageOptions;
}

/**
 * @param {GuildTextThreadManager} threadManager
 * @param {EmbedBuilder[]} embeds
 * @param {Company} company
 */
function createEvergreenBountyThread(threadManager, embeds, company) {
	return threadManager.create({
		name: "Evergreen Bounties",
		message: { embeds },
		appliedTags: [company.bountyBoardOpenTagId]
	}).then(thread => {
		company.evergreenThreadId = thread.id;
		company.save();
		thread.pin();
		return thread;
	})
}

/**
 * @param {ForumChannel} bountyBoardChannel
 * @param {Bounty[]} evergreenBounties
 * @param {Company} company
 * @param {number} companyLevel
 * @param {Guild} guild
 * @param {Record<string, Set<string>>} hunterIdMap
 */
async function updateEvergreenBountyBoard(bountyBoardChannel, evergreenBounties, company, companyLevel, guild, hunterIdMap) {
	const embeds = await Promise.all(evergreenBounties.sort(ascendingByProperty("slotNumber")).map(bounty => buildBountyEmbed(bounty, guild, companyLevel, false, company, hunterIdMap[bounty.id])));
	if (company.evergreenThreadId) {
		return bountyBoardChannel.threads.fetch(company.evergreenThreadId).then(async thread => {
			const message = await thread.fetchStarterMessage();
			message.edit({ embeds });
			return thread;
		});
	} else {
		return createEvergreenBountyThread(bountyBoardChannel.threads, embeds, company);
	}
}

/** Update the bounty's embed in the bounty board
 * @param {Guild} guild
 * @param {Company} company
 * @param {Bounty} bounty
 * @param {number} posterLevel
 * @param {Set<string>} hunterIdSet
 */
async function updatePosting(guild, company, bounty, posterLevel, hunterIdSet) {
	if (!company.bountyBoardId || !bounty.postingId) {
		return null;
	}

	return guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
		return bountyBoard.threads.fetch(bounty.postingId);
	}).then(async thread => {
		if (thread.archived) {
			await thread.setArchived(false, "Unarchived to update posting");
		}
		thread.edit({ name: bounty.title });
		return thread.fetchStarterMessage();
	}).then(async posting => {
		return buildBountyEmbed(bounty, guild, posterLevel, false, company, hunterIdSet).then(embed => {
			posting.edit({ embeds: [embed] });
			return posting;
		})
	})
}

/** If the server has a scoreboard reference channel, update the embed in it
 * @param {Company} company
 * @param {Guild} guild
 * @param {EmbedBuilder[]} embeds
 */
async function updateScoreboard(company, guild, embeds) {
	if (company.scoreboardChannelId && company.scoreboardMessageId) {
		guild.channels.fetch(company.scoreboardChannelId).then(scoreboard => {
			return scoreboard.messages.fetch(company.scoreboardMessageId);
		}).then(async scoreboardMessage => {
			scoreboardMessage.edit({ embeds });
		});
	}
}

/** @param {string} placeholderText */
function disabledSelectRow(placeholderText) {
	return new ActionRowBuilder().addComponents(
		new UserSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
			.setPlaceholder(truncateTextToLength(placeholderText, SelectMenuLimits.MaximumPlaceholderCharacters))
			.setDisabled(true)
	)
}

/**
 * @param {Message} embedMessage
 * @param {string} content
 * @param {string} threadTitle
 */
function sendToRewardsThread(embedMessage, content, threadTitle) {
	const rewardsPayload = { content, flags: MessageFlags.SuppressNotifications };
	if (embedMessage.channel.isThread()) {
		// If already in thread, send message
		embedMessage.channel.send(rewardsPayload);
	} else if (embedMessage.thread !== null) {
		// If not in thread but thread exists, send in thread
		embedMessage.thread.send(rewardsPayload);
	} else {
		// If not in thread and thread doesn't exist, make one
		embedMessage.startThread({ name: threadTitle }).then(thread => {
			thread.send(rewardsPayload);
		})
	}
}

/** Requests dAPI change the roles on guild members based on the provided `seasonResults`
 * @param {Record<string, { newPlacement: number } | { newRankIndex: number | null, rankIncreased: boolean }>} seasonResults
 * @param {Rank[]} descendingRanks
 * @param {GuildMemberManager} guildMemberManager
 */
async function syncRankRoles(seasonResults, descendingRanks, guildMemberManager) {
	const rankChangeIds = [];
	for (const id in seasonResults) {
		if ("newRankIndex" in seasonResults[id] && descendingRanks[seasonResults[id].newRankIndex].roleId) {
			rankChangeIds.push(id);
		}
	}
	const rankRoleIds = descendingRanks.map(rank => rank.roleId).filter(id => !!id);
	const members = await guildMemberManager.fetch({ user: rankChangeIds });
	for (const [id, member] of members) {
		await member.roles.remove(rankRoleIds);
		if (seasonResults[id].newRankIndex !== null) {
			const rankRoleId = descendingRanks[seasonResults[id].newRankIndex].roleId;
			if (rankRoleId) {
				await member.roles.add(rankRoleId).catch(console.error);
			}
		}
	}
}

module.exports = {
	createSubcommandMappings,
	bountiesToSelectOptions,
	rankArrayToSelectOptions,
	truncateTextToLength,
	contentOrFileMessagePayload,
	updateEvergreenBountyBoard,
	createEvergreenBountyThread,
	updatePosting,
	updateScoreboard,
	disabledSelectRow,
	sendToRewardsThread,
	syncRankRoles
};
