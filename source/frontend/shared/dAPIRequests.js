const { GuildTextThreadManager, EmbedBuilder, Guild, MessageFlags, Message, GuildMemberManager, ForumChannel, ThreadChannel, GuildMember } = require("discord.js");
const { Bounty, Company, Rank, Participation } = require("../../database/models");
const { bountyEmbed, overallScoreboardEmbed, seasonalScoreboardEmbed } = require("./dAPISerializers");
const { ascendingByProperty } = require("../../shared");
const { GuildMemberLimits } = require("@sapphire/discord.js-utilities");

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
	const embeds = await Promise.all(evergreenBounties.sort(ascendingByProperty("slotNumber")).map(bounty => bountyEmbed(bounty, guild, companyLevel, false, company, hunterIdMap[bounty.id])));
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
		return bountyEmbed(bounty, guild, posterLevel, false, company, hunterIdSet).then(embed => {
			posting.edit({ embeds: [embed] });
			return posting;
		})
	})
}

/** Update the Seasonal Scoreboard embed in a server's scoreboard reference channel
 * @param {Company} company
 * @param {Guild} guild
 * @param {Map<string, Participation>} participationMap
 * @param {Rank[]} descendingRanks
 * @param {{ requiredGP: number; currentGP: number; }} goalProgress
 */
async function refreshReferenceChannelScoreboardSeasonal(company, guild, participationMap, descendingRanks, goalProgress) {
	if (!company.scoreboardChannelId || !company.scoreboardMessageId) {
		return;
	}

	const scoreboard = await guild.channels.fetch(company.scoreboardChannelId);
	if (!scoreboard) {
		return;
	}
	const embeds = [await seasonalScoreboardEmbed(company, guild, participationMap, descendingRanks, goalProgress)];
	const scoreboardMessage = await scoreboard.messages.fetch(company.scoreboardMessageId);
	if (scoreboardMessage) {
		scoreboardMessage.edit({ embeds });
	} else {
		scoreboard.send({ embeds });
	}
}

/** Update the Overall Scoreboard embed in a server's scoreboard reference channel
 * @param {Company} company
 * @param {Guild} guild
 * @param {Map<string, Hunter>} hunterMap
 * @param {{ requiredGP: number; currentGP: number; }} goalProgress
 */
async function refreshReferenceChannelScoreboardOverall(company, guild, hunterMap, goalProgress) {
	if (!company.scoreboardChannelId || !company.scoreboardMessageId) {
		return;
	}

	const scoreboard = await guild.channels.fetch(company.scoreboardChannelId);
	if (!scoreboard) {
		return;
	}
	const embeds = [await overallScoreboardEmbed(company, guild, hunterMap, goalProgress)];
	const scoreboardMessage = await scoreboard.messages.fetch(company.scoreboardMessageId);
	if (scoreboardMessage) {
		scoreboardMessage.edit({ embeds });
	} else {
		scoreboard.send({ embeds });
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
 * @param {Map<string, Partial<{ title: "Critical Toast!" | "Bounty Poster"; rankUp: { name: string; newRankIndex: number; }; topPlacement: boolean; xp: number; xpMultiplier: string; levelUp: { achievedLevel: number; previousLevel: number; }; item: string; }>>} hunterRecipts
 * @param {Rank[]} descendingRanks
 * @param {GuildMemberManager} guildMemberManager
 */
async function syncRankRoles(hunterRecipts, descendingRanks, guildMemberManager) {
	if (descendingRanks.length < 1) {
		return;
	}

	const rankChangeIds = [];
	for (const [id, receipt] of hunterRecipts) {
		if ("rankUp" in receipt && descendingRanks[receipt.rankUp.newRankIndex].roleId) {
			rankChangeIds.push(id);
		}
	}
	const rankRoleIds = descendingRanks.map(rank => rank.roleId).filter(id => !!id);
	const members = await guildMemberManager.fetch({ user: rankChangeIds });
	for (const [id, member] of members) {
		await member.roles.remove(rankRoleIds);
		const receipt = hunterRecipts.get(id);
		if (receipt?.rankUp.newRankIndex) {
			const rankRoleId = descendingRanks[receipt.rankUp.newRankIndex].roleId;
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

/**
 * @param {GuildMember} bountyBotGuildMember
 * @param {Company} company
 */
async function updateBotNicknameForFestival(bountyBotGuildMember, company) {
	const tagComponents = [];
	if (company.xpFestivalMultiplier > 1) {
		tagComponents.push(["XP", company.xpFestivalMultiplier]);
	}
	if (company.gpFestivalMultiplier > 1) {
		tagComponents.push(["GP", company.gpFestivalMultiplier]);
	}

	if (tagComponents.length > 0) {
		const multiplierTag = tagComponents.map(([type, multiplier]) => `${type} x ${multiplier}`).join(" & ");
		const previousNickname = company.nickname ?? "BountyBot";
		if (previousNickname.length + multiplierTag.length <= GuildMemberLimits.MaximumDisplayNameLength) {
			bountyBotGuildMember.setNickname(`${previousNickname} [${multiplierTag}]`);
		}
	} else {
		// company.nickname will be null if unset, which is the correct value to send dAPI to unset a nickname
		bountyBotGuildMember.setNickname(company.nickname);
	}
}

module.exports = {
	refreshEvergreenBountiesThread,
	makeEvergreenBountiesThread,
	refreshBountyThreadStarterMessage,
	refreshReferenceChannelScoreboardSeasonal,
	refreshReferenceChannelScoreboardOverall,
	sendRewardMessage,
	syncRankRoles,
	unarchiveAndUnlockThread,
	updateBotNicknameForFestival
};
