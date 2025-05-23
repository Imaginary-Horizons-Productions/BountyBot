const { Guild } = require("discord.js");
const { Rank, Season, Hunter, Participation } = require("../../database/models");
const { congratulationBuilder } = require("./messageParts");

/** Recalculates the ranks (standard deviations from mean) and placements (ordinal) for the given participants
 * @param {Season} season
 * @param {Hunter[]} allHunters
 * @param {Rank[]} ranks
 * @param {Participation} participations
 * @returns Promise of the message congratulating the hunter reaching first place (or `null` if no change)
 */
async function calculateRanks(season, allHunters, ranks, participations) {
	const particpationMap = participations.reduce((map, participation) => {
		map[participation.userId] = participation;
		return map;
	}, {});

	let previousFirstPlaceId;
	const rankableHunters = [];
	for (const hunter of allHunters) {
		const participation = particpationMap[hunter.userId];
		if (participation && !participation.isRankDisqualified) {
			if (participation?.placement == 1) {
				previousFirstPlaceId = hunter.userId;
			}
			hunter.lastRank = hunter.rank;
			rankableHunters.push(hunter);
		} else {
			hunter.nextRankXP = 0;
		}
	}

	if (rankableHunters.length < 2) {
		for (const hunter of allHunters) {
			hunter.rank = null;
			hunter.save();
		}
		return null;
	}

	const mean = (await season.totalXP) / allHunters.length;
	const stdDev = Math.sqrt(rankableHunters.reduce((total, hunter) => {
		return total + (particpationMap[hunter.userId].xp - mean) ** 2
	}, 0) / rankableHunters.length);
	if (ranks?.length > 0) {
		for (const hunter of rankableHunters) {
			let variance = (particpationMap[hunter.userId].xp - mean) / stdDev;
			let index = -1;
			for (const rank of ranks) {
				index++;
				if (variance >= rank.threshold) {
					break;
				}
			}
			hunter.rank = index;
			hunter.nextRankXP = Math.ceil(stdDev * ranks[hunter.rank].threshold + mean - particpationMap[hunter.userId].xp);
			hunter.save();
		}
	}
	let recentPlacement = participations.length;
	let previousScore = 0;
	let firstPlaceId;
	// subtract 1 to adjust for array indexes starting from 0
	for (let i = recentPlacement - 1; i >= 0; i -= 1) {
		const participation = participations[i];
		if (participation.xp > previousScore) {
			previousScore = participation.xp;
			recentPlacement = i + 1;
			participation.placement = recentPlacement;
		} else {
			participation.placement = recentPlacement;
			if (recentPlacement === 1 && participation.userId !== previousFirstPlaceId) {
				// Feature: No first place message on first season XP of season (no one to compete with)
				firstPlaceId = participation.userId;
			}
		}
		participation.save();
	}
	return firstPlaceId ? `*<@${firstPlaceId}> has reached the #1 spot for this season!*` : null;
}

/** Update ranks for all hunters in the guild, then return rank up messages
 * @param {Guild} guild
 * @param {typeof import("../../logic")} logicLayer
 * @returns an array of rank and placement update strings
 */
async function getRankUpdates(guild, logicLayer) {
	const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(guild.id);
	const ranks = await logicLayer.ranks.findAllRanks(guild.id);
	const allHunters = await logicLayer.hunters.findCompanyHunters(guild.id);
	const participations = await logicLayer.seasons.findSeasonParticipations(season.id);

	return calculateRanks(season, allHunters, ranks, participations).then(async (firstPlaceMessage) => {
		const roleIds = ranks.filter(rank => rank.roleId).map(rank => rank.roleId);
		const outMessages = [];
		if (firstPlaceMessage) {
			outMessages.push(firstPlaceMessage);
		}
		const userIdsWithChangedRanks = [];
		for (const hunter of allHunters) {
			if (hunter.rank !== hunter.lastRank) {
				userIdsWithChangedRanks.push(hunter.userId);
			}
		}
		const updatedMembers = await guild.members.fetch({ user: userIdsWithChangedRanks });
		const updatedParticipationsMap = (await logicLayer.seasons.bulkFindParticipations(season.id, userIdsWithChangedRanks))
			.reduce((map, participation) => {
				map[participation.userId] = participation;
				return map;
			}, {});
		for (const member of updatedMembers.values()) {
			if (member.manageable) {
				await member.roles.remove(roleIds);
				// Feature: remove rank roles from DQ'd users but don't give them new ones
				if (member.id in updatedParticipationsMap && !updatedParticipationsMap[member.id].isRankDisqualified) {
					let destinationRole;
					const hunter = allHunters.find(hunter => member.id === hunter.userId);
					const rankRoleId = ranks[hunter.rank]?.roleId;
					if (rankRoleId) {
						await member.roles.add(rankRoleId).catch(console.error);
						destinationRole = await guild.roles.fetch(rankRoleId);
					}
					// Note: higher ranks are lower value
					if (destinationRole && (hunter.lastRank === null || hunter.rank < hunter.lastRank)) {
						outMessages.push(`${congratulationBuilder()}, ${member.toString()}! You've risen to ${destinationRole.name}!`);
					}
				}
			}
		}
		return outMessages;
	});
}

module.exports = { getRankUpdates };
