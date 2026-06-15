import { Collection, Role, Snowflake } from "discord.js";
import { Op } from "sequelize";
import { Database, DatabaseTypes } from "../database";
import { Participation } from "../database/models/Participation";
import { descendingByProperty } from "../shared";
import { calculateXPMean, calculateXPStandardDeviation } from "./shared";

let db: Database;

/** *Sets the database pointer for the Season logic file* */
export function setDB(database: Database) {
	db = database;
}

export function createSeason(companyId: Snowflake) {
	return db.Seasons.create({ companyId })
}

export function findOrCreateCurrentSeason(companyId: Snowflake) {
	return db.Seasons.findOrCreate({ where: { companyId, isCurrentSeason: true } });
}

export function findOneSeason(companyId: Snowflake, type: "current" | "previous") {
	switch (type) {
		case "current":
			return db.Seasons.findOne({ where: { companyId, isCurrentSeason: true } });
		case "previous":
			return db.Seasons.findOne({ where: { companyId, isPreviousSeason: true } });
	}
}

/** *Get the number of participating bounty hunters in the specified Season* */
export function getParticipantCount(seasonId: string) {
	return db.Participations.count({ where: { seasonId } });
}

/** *Counts the number of times the specified Hunter has been DQ'd* */
export function getDQCount(userId: Snowflake, companyId: Snowflake) {
	return db.Participations.sum("dqCount", { where: { userId, companyId } }) ?? 0;
}

/** *Returns a Map of userId to Participation for all Participations in the specified Season* */
export async function getParticipationMap(seasonId: string) {
	const participationMap = new Map<string, DatabaseTypes.Participation>();
	const participations = await db.Participations.findAll({ where: { seasonId } });
	for (const participation of participations) {
		participationMap.set(participation.userId, participation);
	}
	return participationMap;
}

/** *Get Participations of the specified Users in the specified Season* */
export function bulkFindParticipations(seasonId: string, userIds: Snowflake[]) {
	return db.Participations.findAll({ where: { seasonId, userId: { [Op.in]: userIds } } });
}

/** *Get all the Participations of a specified Hunter* */
export function findHunterParticipations(userId: Snowflake, companyId: Snowflake) {
	return db.Participations.findAll({ where: { userId, companyId }, order: [["createdAt", "DESC"]] });
}

/** *Find the first place Participation in the specified Company and Season* */
export function findFirstPlaceParticipation(companyId: Snowflake, seasonId: string) {
	return db.Participations.findOne({ where: { companyId, seasonId, placement: 1 } });
}

/** *Finds the Participation of the specified Season's Hunter with the most of the specified Participation property* */
export async function findParticipationWithTopParticipationStat(companyId: Snowflake, seasonId: string, participationProperty: keyof Participation) {
	const participation = await db.Participations.findOne({ where: { companyId, seasonId }, order: [[participationProperty, "DESC"]] });
	if (participation === null || participation[participationProperty] === 0) {
		return null;
	}
	return participation;
}

/** Calculates the XP required for the specified Hunter to reach the next Rank */
export async function nextRankXP(userId: Snowflake, season: DatabaseTypes.Season, descendingRanks: DatabaseTypes.Rank[]) {
	const participationMap = await getParticipationMap(season.id);
	const participation = participationMap.get(userId);
	if (!participation || participation.rankIndex === null || participation.rankIndex === 0) {
		return 0;
	}
	const mean = calculateXPMean(participationMap);
	if (mean === null) {
		return 0;
	}
	const xpStandardDeviation = calculateXPStandardDeviation(participationMap, mean);
	if (xpStandardDeviation === null) {
		return 0;
	}
	return Math.ceil(xpStandardDeviation * descendingRanks[participation.rankIndex - 1].threshold + mean - participation.xp);
}


/** Recalculate placement and rank changes based on changed XP values on Participations and updates the database */
export async function updatePlacementsAndRanks(participationMap: Map<string, DatabaseTypes.Participation>, descendingRanks: DatabaseTypes.Rank[], allGuildRoles: Collection<Snowflake, Role>) {
	const seasonalHunterReceipts = new Map();
	if (participationMap.size < 1) {
		return seasonalHunterReceipts;
	}
	const placementChanges = await calculatePlacementChanges(participationMap);
	const mean = calculateXPMean(participationMap);
	if (mean === null) {
		return seasonalHunterReceipts;
	}
	const standardDeviation = calculateXPStandardDeviation(participationMap, mean);
	if (standardDeviation === null) {
		return seasonalHunterReceipts;
	}

	// Calculate Rank Changes
	const rankChanges: Record<string, { index: number | null; isRankUp: boolean; }> = {};
	if (descendingRanks.length > 0) {
		for (const [id, participation] of participationMap) {
			const standardDeviationsFromMean = (participation.xp - mean) / standardDeviation;
			let index = 0;
			for (const rank of descendingRanks) {
				if (standardDeviationsFromMean >= rank.threshold) {
					break;
				}
				index++;
			}
			const previousRankIndex = participation.rankIndex === null ? descendingRanks.length : participation.rankIndex;
			rankChanges[id] = { index: index === descendingRanks.length ? null : index, isRankUp: index < previousRankIndex };
		}
	}

	for (const id of new Set(Object.keys(placementChanges).concat(Object.keys(rankChanges)))) {
		const updatePayload: Partial<{ placement: number; rankIndex: number | null; }> = {};
		const rawReceipt: Partial<{ topPlacement: boolean; rankUp: { name: string; newRankIndex: number | null; }; }> = {};
		if (id in placementChanges) {
			updatePayload.placement = placementChanges[id];
			if (placementChanges[id] === 1) {
				rawReceipt.topPlacement = true;
			}
		}
		if (id in rankChanges) {
			const { index, isRankUp } = rankChanges[id];
			updatePayload.rankIndex = index;
			if (isRankUp && index !== null) {
				const rank = descendingRanks[index];
				rawReceipt.rankUp = { name: rank.getName(allGuildRoles, index), newRankIndex: index };
			}
		}
		const participation = participationMap.get(id);
		if (!participation) {
			throw new Error(`Failed to find participation with id ${id} in updatePlacementsAndRanks`);
		}
		await participation.update(updatePayload);
		seasonalHunterReceipts.set(id, rawReceipt);
	}
	return seasonalHunterReceipts;
}

/** *Generates a map of all of a Season's Participations' placement changes* */
export async function calculatePlacementChanges(participationMap: Map<any, DatabaseTypes.Participation>) {
	// @ts-expect-error type guard for key in descendingByProperty required?
	const participationArray = Array.from(participationMap.values()).sort(descendingByProperty("xp"));
	let recentPlacement = participationMap.size;
	let previousScore = 0;
	const placementChanges: Record<string, number> = {};
	// subtract 1 to adjust for array indexes starting from 0
	for (let i = recentPlacement - 1; i >= 0; i -= 1) {
		const participation = participationArray[i];
		if (participation.xp > previousScore) {
			previousScore = participation.xp;
			recentPlacement = i + 1;
		}
		if (participation.placement !== recentPlacement) {
			placementChanges[participation.userId] = recentPlacement;
		}
	}
	return placementChanges;
}

/** *Change the specified Hunter's Seasonal XP*
 *
 * negative xp allowed
 */
export async function changeSeasonXP(userId: Snowflake, companyId: Snowflake, seasonId: string, xp: number) {
	const [participation, participationCreated] = await db.Participations.findOrCreate({ where: { userId, companyId, seasonId }, defaults: { xp } });
	if (!participationCreated) {
		await participation.increment({ xp });
	}
	return participationCreated;
}

export async function incrementSeasonStat(companyId: Snowflake, stat: string) {
	const [season] = await findOrCreateCurrentSeason(companyId);
	return season.increment(stat);
}

export async function toggleHunterSeasonDisqualification(userId: Snowflake, companyId: Snowflake, seasonId: string) {
	await db.Users.findOrCreate({ where: { id: userId } });
	const [participation, participationCreated] = await db.Participations.findOrCreate({ where: { userId, companyId, seasonId }, defaults: { isRankDisqualified: true } });
	if (!participationCreated) {
		await participation.update({ isRankDisqualified: !participation.isRankDisqualified });
	}
	if (participationCreated || participation.isRankDisqualified) {
		await participation.increment("dqCount");
	}
	return participation;
}

export async function deleteCompanySeasons(companyId: Snowflake) {
	await db.Participations.destroy({ where: { companyId } });
	return db.Seasons.destroy({ where: { companyId } });
}

export async function deleteHunterParticipations(userId: Snowflake, companyId: Snowflake) {
	return db.Participations.destroy({ where: { userId, companyId } });
}

/** *Delete all Participations associated with the specified Season* */
export function deleteSeasonParticipations(seasonId: string) {
	return db.Participations.destroy({ where: { seasonId } });
}
