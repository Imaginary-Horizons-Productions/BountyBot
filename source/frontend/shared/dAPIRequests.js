const { CommandInteraction, GuildTextThreadManager, EmbedBuilder, Guild, Collection, Role, MessageFlags, Message, GuildMemberManager, ForumChannel, ThreadChannel } = require("discord.js");
const { SubcommandWrapper } = require("../classes");
const { Bounty, Company, Rank } = require("../../database/models");
const { buildBountyEmbed } = require("./messageParts");
const { SelectMenuLimits, MessageLimits } = require("@sapphire/discord.js-utilities");
const { ascendingByProperty } = require("../../shared");

/**
 * @file Discord API (dAPI) Requests - groups of requests to dAPI formalized into functions
 *
 * Naming Convention:
 * - verb first, avoid HTML method verbs (many functions will use more than one)
 * - describe entity in BountyBot context (eg "EvergreenBountyBoard" instead of "ForumChannel")
 */

/**
 * @param {GuildTextThreadManager} threadManager
 * @param {EmbedBuilder[]} embeds
 * @param {Company} company
 */
function makeEvergreenBountiesThread(threadManager, embeds, company) {
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
async function refreshEvergreenBountiesThread(bountyBoardChannel, evergreenBounties, company, companyLevel, guild, hunterIdMap) {
	const embeds = await Promise.all(evergreenBounties.sort(ascendingByProperty("slotNumber")).map(bounty => buildBountyEmbed(bounty, guild, companyLevel, false, company, hunterIdMap[bounty.id])));
	if (company.evergreenThreadId) {
		return bountyBoardChannel.threads.fetch(company.evergreenThreadId).then(async thread => {
			const message = await thread.fetchStarterMessage();
			message.edit({ embeds });
			return thread;
		});
	} else {
		return makeEvergreenBountiesThread(bountyBoardChannel.threads, embeds, company);
	}
}

/** Update the bounty's embed in the bounty board
 * @param {Guild} guild
 * @param {Company} company
 * @param {Bounty} bounty
 * @param {number} posterLevel
 * @param {Set<string>} hunterIdSet
 */
async function refreshBountyThreadStarterMessage(guild, company, bounty, posterLevel, hunterIdSet) {
	if (!company.bountyBoardId || !bounty.postingId) {
		return null;
	}

	return guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
		return bountyBoard.threads.fetch(bounty.postingId);
	}).then(async thread => {
		await unarchiveAndUnlockThread(thread, "Unarchived to update posting");
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
async function refreshReferenceChannelScoreboard(company, guild, embeds) {
	if (company.scoreboardChannelId && company.scoreboardMessageId) {
		guild.channels.fetch(company.scoreboardChannelId).then(scoreboard => {
			return scoreboard.messages.fetch(company.scoreboardMessageId);
		}).then(async scoreboardMessage => {
			scoreboardMessage.edit({ embeds });
		});
	}
}

/**
 * @param {Message} embedMessage
 * @param {string} content
 * @param {string} threadTitle
 */
function sendRewardMessage(embedMessage, content, threadTitle) {
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

/**
 * @param {ThreadChannel} thread
 * @param {string} auditLogReason
 */
async function unarchiveAndUnlockThread(thread, auditLogReason) {
	if (thread.archived) {
		await thread.setArchived(false, auditLogReason);
	}
	if (thread.locked) {
		await thread.setLocked(false, auditLogReason);
	}
}

module.exports = {
	refreshEvergreenBountiesThread,
	makeEvergreenBountiesThread,
	refreshBountyThreadStarterMessage,
	refreshReferenceChannelScoreboard,
	sendRewardMessage,
	syncRankRoles,
	unarchiveAndUnlockThread
};
