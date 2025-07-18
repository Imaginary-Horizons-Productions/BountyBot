const { Sequelize, Op } = require("sequelize");
const { Participation, Rank, Season } = require("../database/models");
const { calculateXPMean, calculateXPStandardDeviation } = require("./shared");
const { descendingByProperty } = require("../shared");

/** @type {Sequelize} */
let db;

/** *Sets the database pointer for the Season logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** @param {string} companyId */
function createSeason(companyId) {
	return db.models.Season.create({ companyId })
}

/** @param {string} companyId */
function findOrCreateCurrentSeason(companyId) {
	return db.models.Season.findOrCreate({ where: { companyId, isCurrentSeason: true } });
}

/**
 * @param {string} companyId
 * @param {"current" | "previous"} type
 */
function findOneSeason(companyId, type) {
	switch (type) {
		case "current":
			return db.models.Season.findOne({ where: { companyId, isCurrentSeason: true } });
		case "previous":
			return db.models.Season.findOne({ where: { companyId, isPreviousSeason: true } });
	}
}

/** *Get the number of participating bounty hunters in the specified Season*
 * @param {string} seasonId
 */
function getParticipantCount(seasonId) {
	return db.models.Participation.count({ where: { seasonId } });
}

/** *Counts the number of times the specified Hunter has been DQ'd*
 * @param {string} userId
 * @param {string} companyId
 */
function getDQCount(userId, companyId) {
	return db.models.Participation.sum("dqCount", { where: { userId, companyId } }) ?? 0;
}

/** *Returns a Map of userId to Participation for all Participations in the specified Season*
 * @param {string} seasonId
 */
async function getParticipationMap(seasonId) {
	/** @type {Map<string, Participation>} */
	const participationMap = new Map();
	const participations = await db.models.Participation.findAll({ where: { seasonId } });
	for (const participation of participations) {
		participationMap.set(participation.userId, participation);
	}
	return participationMap;
}

/** *Get Participations of the specified Users in the specified Season*
 * @param {string} seasonId
 * @param {string[]} userIds
 */
function bulkFindParticipations(seasonId, userIds) {
	return db.models.Participation.findAll({ where: { seasonId, userId: { [Op.in]: userIds } } });
}

/** *Get all the Participations of a specified Hunter*
 * @param {string} userId
 * @param {string} companyId
 */
function findHunterParticipations(userId, companyId) {
	return db.models.Participation.findAll({ where: { userId, companyId }, order: [["createdAt", "DESC"]] });
}

/** *Find the first place Participation in the specified Company and Season*
 * @param {string} companyId
 * @param {string} seasonId
 */
function findFirstPlaceParticipation(companyId, seasonId) {
	return db.models.Participation.findOne({ where: { companyId, seasonId, placement: 1 } });
}

/** *Finds the Participation of the specified Season's Hunter with the most of the specified Participation property*
 * @param {string} companyId
 * @param {string} seasonId
 * @param {string} participationProperty
 */
async function findParticipationWithTopParticipationStat(companyId, seasonId, participationProperty) {
	const participation = await db.models.Participation.findOne({ where: { companyId, seasonId }, order: [[participationProperty, "DESC"]] });
	if (participation === null || participation[participationProperty] === 0) {
		return null;
	}
	return participation;
}

/** Calculates the XP required for the specified Hunter to reach the next Rank
 * @param {string} userId
 * @param {Season} season
 * @param {Rank[]} descendingRanks
 */
async function nextRankXP(userId, season, descendingRanks) {
	const participationMap = await getParticipationMap(season.id);
	const participation = participationMap.get(userId);
	if (participation?.rankIndex === null || participation.rankIndex === 0) {
		return 0;
	}
	const mean = calculateXPMean(participationMap);
	const xpStandardDeviation = calculateXPStandardDeviation(participationMap, mean);
	return Math.ceil(xpStandardDeviation * descendingRanks[participation.rankIndex - 1].threshold + mean - participation.xp);
}


/** Recalculate placement and rank changes based on changed XP values on Participations and updates the database
 * @param {Map<string, Participation>} participationMap
 * @param {Rank[]} descendingRanks
 */
async function updatePlacementsAndRanks(participationMap, descendingRanks) {
	if (participationMap.size < 1) {
		return {};
	}
	const placementChanges = await calculatePlacementChanges(participationMap);
	const mean = calculateXPMean(participationMap);
	const xpStandardDeviation = calculateXPStandardDeviation(participationMap, mean);
	const rankChanges = await calculateRankChanges(xpStandardDeviation, participationMap, descendingRanks);
	/** @type {Record<string, { newPlacement: number } | { newRankIndex: number | null, rankIncreased: boolean }>} */
	const results = {};
	for (const id of new Set(Object.keys(placementChanges).concat(Object.keys(rankChanges)))) {
		const updatePayload = {};
		if (id in placementChanges) {
			updatePayload.placement = placementChanges[id];
			if (id in results) {
				results[id].newPlacement = placementChanges[id];
			} else {
				results[id] = { newPlacement: placementChanges[id] };
			}
		}
		if (id in rankChanges) {
			const { index, isIncrease } = rankChanges[id];
			updatePayload.rankIndex = index;
			if (id in results) {
				results[id].newRankIndex = index;
				results[id].rankIncreased = isIncrease;
			} else {
				results[id] = { newRankIndex: index, rankIncreased: isIncrease };
			}
		}
		await participationMap.get(id).update(updatePayload);
	}
	return results;
}

/**
 * @param {number} standardDeviation
 * @param {Map<string, Participation>} participationMap
 * @param {Rank[]} descendingRanks
 */
async function calculateRankChanges(standardDeviation, participationMap, descendingRanks) {
	/** @type {Record<string, { index: number | null, isIncrease: boolean }>} */
	const rankChanges = {};
	if (descendingRanks.length > 0) {
		for (const [id, participation] of participationMap) {
			const standardDeviationsFromMean = (participation.xp - calculateXPMean(participationMap)) / standardDeviation;
			let index = -1;
			for (const rank of descendingRanks) {
				index++;
				if (standardDeviationsFromMean >= rank.threshold) {
					break;
				}
			}
			if (index === -1) {
				index = null;
			}
			rankChanges[id] = { index, isIncrease: index > participation.rankIndex };
		}
	}
	return rankChanges;
}

/** *Generates a map of all of a Season's Participations' placement changes*
 * @param {Map<any, Participation>} participationMap
 */
async function calculatePlacementChanges(participationMap) {
	const participationArray = Array.from(participationMap.values()).sort(descendingByProperty("xp"));
	let recentPlacement = participationMap.size;
	let previousScore = 0;
	const placementChanges = {};
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
 * @param {string} userId
 * @param {string} companyId
 * @param {string} seasonId
 * @param {number} xp negative numbers allowed
 */
async function changeSeasonXP(userId, companyId, seasonId, xp) {
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { userId, companyId, seasonId }, defaults: { xp } });
	if (!participationCreated) {
		await participation.increment({ xp });
	}
	return participationCreated;
}

/**
 * @param {string} companyId
 * @param {string} stat
 */
async function incrementSeasonStat(guildId, stat) {
	const [season] = await findOrCreateCurrentSeason(guildId);
	return season.increment(stat);
}

/**
 * @param {string} userId
 * @param {string} companyId
 * @param {string} seasonId
 */
async function toggleHunterSeasonDisqualification(userId, companyId, seasonId) {
	await db.models.User.findOrCreate({ where: { id: userId } });
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { userId, companyId, seasonId }, defaults: { isRankDisqualified: true } });
	if (!participationCreated) {
		await participation.update({ isRankDisqualified: !participation.isRankDisqualified });
	}
	if (participationCreated || participation.isRankDisqualified) {
		await participation.increment("dqCount");
	}
	return participation;
}

/** @param {string} companyId */
async function deleteCompanySeasons(companyId) {
	await db.models.Participation.destroy({ where: { companyId } });
	return db.models.Season.destroy({ where: { companyId } });
}

/** *Delete all Participations associated with the specified Season*
 * @param {string} seasonId
 */
function deleteSeasonParticipations(seasonId) {
	return db.models.Participation.destroy({ where: { seasonId } });
}

module.exports = {
	setDB,
	createSeason,
	findOrCreateCurrentSeason,
	findOneSeason,
	getParticipantCount,
	getDQCount,
	getParticipationMap,
	bulkFindParticipations,
	findHunterParticipations,
	findFirstPlaceParticipation,
	findParticipationWithTopParticipationStat,
	nextRankXP,
	updatePlacementsAndRanks,
	changeSeasonXP,
	incrementSeasonStat,
	toggleHunterSeasonDisqualification,
	deleteCompanySeasons,
	deleteSeasonParticipations
}
