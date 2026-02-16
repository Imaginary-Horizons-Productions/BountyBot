const { GuildTextThreadManager, EmbedBuilder, Guild, MessageFlags, Message, GuildMemberManager, ForumChannel, ThreadChannel } = require("discord.js");
const { Bounty, Company, Rank, Participation } = require("../../database/models");
const { bountyEmbed, seasonalScoreboardEmbed, overallScoreboardEmbed } = require("./dAPISerializers");
const { ascendingByProperty } = require("../../shared");
const { fillableTextBar } = require("./stringConstructors");

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

async function updateSecondersField(toastMessage, goalProgress) {
	const embed = new EmbedBuilder(toastMessage.embeds[0].data);
	const secondedFieldIndex = embed.data.fields?.findIndex(field => field.name === "Seconded by") ?? -1;
	if (secondedFieldIndex === -1) {
		embed.addFields({ name: "Seconded by", value: user.toString() });
	} else {
		embed.spliceFields(secondedFieldIndex, 1, { name: "Seconded by", value: `${toastMessage.embeds[0].data.fields[secondedFieldIndex].value}, ${user.toString()}` });
	}
	const goalProgressFieldIndex = embed.data.fields?.findIndex(field => field.name === "Server Goal") ?? -1;
	if (goalProgressFieldIndex !== -1) {
		const { goalId, currentGP, requiredGP } = await logicBlob.goals.findLatestGoalProgress(reaction.message.guildId);
		if (goalId !== null) {
			embed.spliceFields(goalProgressFieldIndex, 1, { name: "Server Goal", value: `${fillableTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
		} else {
			embed.spliceFields(goalProgressFieldIndex, 1, { name: "Server Goal", value: `${fillableTextBar(15, 15, 15)} Complete!` });
		}
	}
	toastMessage.edit({ embeds: [embed] });
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

module.exports = {
	refreshEvergreenBountiesThread,
	makeEvergreenBountiesThread,
	refreshBountyThreadStarterMessage,
	refreshReferenceChannelScoreboardSeasonal,
	refreshReferenceChannelScoreboardOverall,
	sendRewardMessage,
	updateSecondersField,
	syncRankRoles,
	unarchiveAndUnlockThread
};
