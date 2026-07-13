import { Snowflake } from "discord.js";
import { Op } from "sequelize";
import { Database, DatabaseTypes } from "../database";

let db: Database;

/** *Sets the database pointer for the Hunter logic file* */
export function setDB(database: Database) {
	db = database;
}

/** *Avoids the foreign key error caused by creating a Hunter before their User exists*
 *
 * Requires that the Company housing the Hunter exists
 */
export async function findOrCreateBountyHunter(userId: Snowflake, companyId: Snowflake) {
	return {
		user: await db.Users.findOrCreate({ where: { id: userId } }),
		hunter: await db.Hunters.findOrCreate({ where: { userId, companyId } })
	}
}

/** *Queries directly for a Hunter*
 *
 * If the Hunter might not exist yet, use `findOrCreateBountyHunter` instead
 */
export function findOneHunter(userId: Snowflake, companyId: Snowflake) {
	return db.Hunters.findOne({ where: { userId, companyId } });
}

/** *Returns a map of userId to Hunter for all Hunters in the specified Company* */
export async function getCompanyHunterMap(companyId: Snowflake) {
	const hunterMap = new Map<string, DatabaseTypes.Hunter>();
	const hunters = await db.Hunters.findAll({ where: { companyId } });
	for (const hunter of hunters) {
		hunterMap.set(hunter.userId, hunter);
	}
	return hunterMap;
}

/** *Find the ids of all rank qualified Hunters in the specified Company that are at or above the specified Rank* */
export async function createHunterMapAtOrAboveRank(companyId: Snowflake, rankIndex: number) {
	const hunterMap = new Map();
	const season = await db.Seasons.findOne({ where: { companyId, isCurrentSeason: true } });
	if (!season) {
		return hunterMap;
	}
	const participations = await db.Participations.findAll({ where: { seasonId: season.id, rankIndex: { [Op.lte]: rankIndex }, isRankDisqualified: false } });
	const hunters = await db.Hunters.findAll({ where: { companyId, userId: { [Op.in]: participations.map(participation => participation.userId) } } });
	for (const hunter of hunters) {
		hunterMap.set(hunter.userId, hunter);
	}
	return hunterMap;
}

/** *Find all Hunters in the specified Company, ordered by descending XP* */
export function findCompanyHuntersByDescendingXP(companyId: Snowflake) {
	return db.Hunters.findAll({ where: { companyId }, order: [["xp", "DESC"]] });
}

/** *Find all Hunters in the specified Company at or above the level threshold* */
export async function findHuntersAtOrAboveLevel(company: DatabaseTypes.Company, levelThreshold: number) {
	return (await db.Hunters.findAll({ where: { companyId: company.id } })).filter(hunter => hunter.getLevel(company.xpCoefficient) >= levelThreshold);
}

/** *Sets a Hunter's Profile Color* */
export function setHunterProfileColor(userId: Snowflake, companyId: Snowflake, color: string) {
	return db.Hunters.update({ profileColor: color }, { where: { userId, companyId } });
}

/** *Destroys all of the specified Company's Hunters* */
export function deleteCompanyHunters(companyId: Snowflake) {
	return db.Hunters.destroy({ where: { companyId } });
}

export function deleteHunter(userId: Snowflake, companyId: Snowflake) {
	return db.Hunters.destroy({ where: { userId, companyId } })
}
