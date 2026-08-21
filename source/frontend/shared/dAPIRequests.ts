import type { MessageEditOptions, PublicThreadChannel, Snowflake } from "discord.js";
import { EmbedBuilder, ForumChannel, Guild, GuildMember, GuildMemberManager, GuildTextThreadManager, Message, MessageFlags, ThreadChannel } from "discord.js";
import { DatabaseTypes } from "../../database/index.ts";
import { MAX_BOT_NICKNAME_LENGTH } from "../../shared/constants.ts";
import { ascendingByProperty } from "../../shared/index.ts";
import type { HunterReceiptMap } from "../../shared/types.ts";
import { butIgnoreUnknownChannelErrors, isUnknownMessageError } from "./dAPIResponses.ts";
import { bountyEmbed, overallScoreboardEmbed, seasonalScoreboardEmbed } from "./dAPISerializers.ts";

/**
 * @file Discord API (dAPI) Requests - groups of requests to dAPI formalized into functions
 *
 * Naming Convention:
 * - verb first, avoid HTML method verbs (many functions will use more than one)
 * - describe entity in BountyBot context (eg "EvergreenBountyBoard" instead of "ForumChannel")
 */

export async function makeEvergreenBountiesThread(threadManager: GuildTextThreadManager<PublicThreadChannel>, embeds: EmbedBuilder[], company: DatabaseTypes.Company) {
	const thread = await threadManager.create({
		name: "Evergreen Bounties",
		message: { embeds },
		appliedTags: [company.bountyBoardOpenTagId]
	});
	company.update({ evergreenThreadId: thread.id });
	thread.pin();
	return thread;
}

export async function refreshEvergreenBountiesThread(bountyBoardChannel: ForumChannel, evergreenBounties: DatabaseTypes.Bounty[], company: DatabaseTypes.Company, companyLevel: number, bountyBotGuildMember: GuildMember, hunterIdMap: Record<string, Set<string>>) {
	if (evergreenBounties.length < 1) {
		return;
	}

	const embeds = evergreenBounties.sort(ascendingByProperty("slotNumber")).map(bounty => bountyEmbed(bounty, bountyBotGuildMember, companyLevel, false, company, hunterIdMap[bounty.id]));
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

export async function unarchiveAndUnlockThread(thread: ThreadChannel, auditLogReason: string) {
	if (thread.archived) {
		await thread.setArchived(false, auditLogReason);
	}
	if (thread.locked) {
		await thread.setLocked(false, auditLogReason);
	}
}

export const auditReasonBountyComplete = "bounty marked completed by poster";

/** Updates the embeds in a forum thread's title and starter message
 *
 * auditLogReason the reason to group all changes under in the server's audit log
 */
export async function refreshBountyBoardThread(starterMessage: Message, { title, embed }: { title: string; embed: EmbedBuilder; }, auditLogReason: string) {
	if (starterMessage.channel.isDMBased()) {
		return;
	}
	if (title !== starterMessage.channel.name) {
		starterMessage.channel.edit({ name: title, reason: auditLogReason });
	}

	const starterMessageEditPayload: MessageEditOptions = { embeds: [embed] };
	if (auditLogReason === auditReasonBountyComplete) {
		starterMessageEditPayload.components = [];
	}
	starterMessage.edit(starterMessageEditPayload);
}

/** Fetches a bounty's thread from the bounty board forum */
export async function getBountyBoardThread(guild: Guild, bountyBoardId: Snowflake | null, postingId: Snowflake | null) {
	if (!bountyBoardId || !postingId) {
		return null;
	}
	const bountyBoard = await guild.channels.fetch(bountyBoardId).catch(butIgnoreUnknownChannelErrors);
	if (!bountyBoard || !bountyBoard.isThreadOnly()) { //TODONOW consider cleaning up db
		return null;
	}
	return bountyBoard.threads.fetch(postingId).catch(error => {
		if (!isUnknownMessageError(error)) {
			console.error(error);
		}
		return null;
	});
}

/** Update the Seasonal Scoreboard embed in a server's scoreboard reference channel */
export async function refreshReferenceChannelScoreboardSeasonal(company: DatabaseTypes.Company, guild: Guild, participationMap: Map<string, DatabaseTypes.Participation>, descendingRanks: DatabaseTypes.Rank[], goalProgress: { requiredGP: number; currentGP: number; }) {
	if (!company.scoreboardChannelId || !company.scoreboardMessageId) {
		return;
	}

	const scoreboard = await guild.channels.fetch(company.scoreboardChannelId);
	if (!scoreboard || !scoreboard.isSendable()) { //TODONOW consider cleaning up db
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

/** Update the Overall Scoreboard embed in a server's scoreboard reference channel */
export async function refreshReferenceChannelScoreboardOverall(company: DatabaseTypes.Company, guild: Guild, hunterMap: Map<string, DatabaseTypes.Hunter>, goalProgress: { requiredGP: number; currentGP: number; }) {
	if (!company.scoreboardChannelId || !company.scoreboardMessageId) {
		return;
	}

	const scoreboard = await guild.channels.fetch(company.scoreboardChannelId);
	if (!scoreboard || !scoreboard.isSendable()) { //TODONOW consider cleaning up db
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

export function sendRewardMessage(embedMessage: Message, content: string, threadTitle: string) {
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

/** Requests dAPI change the roles on guild members based on the provided `seasonResults` */
export async function syncRankRoles(hunterRecipts: HunterReceiptMap, descendingRanks: DatabaseTypes.Rank[], guildMemberManager: GuildMemberManager) {
	if (descendingRanks.length < 1) {
		return;
	}

	const rankChangeIds = [];
	for (const [id, receipt] of hunterRecipts) {
		if (receipt.rankUp && descendingRanks[receipt.rankUp.newRankIndex].roleId) {
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

export async function updateBotNicknameForFestival(bountyBotGuildMember: GuildMember, company: DatabaseTypes.Company) {
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
		if (previousNickname.length + multiplierTag.length <= MAX_BOT_NICKNAME_LENGTH) {
			bountyBotGuildMember.setNickname(`${previousNickname} [${multiplierTag}]`);
		}
	} else {
		// company.nickname will be null if unset, which is the correct value to send dAPI to unset a nickname
		bountyBotGuildMember.setNickname(company.nickname);
	}
}
