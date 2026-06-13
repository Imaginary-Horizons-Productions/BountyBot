import { Snowflake } from "discord.js";
import { Op } from "sequelize";
import { Database } from "../database";

let db: Database;

/** *Set the database pointer for the Rank logic file* */
export function setDB(database: Database) {
	db = database;
}

const DEFAULT_VARIANCE_THRESHOLDS = [2.5, 1, 0, -3];
const DEFAULT_RANKMOJI = ["🏆", "🥇", "🥈", "🥉"];

/** *Creates Ranks for a Company with the default emoji and variance thresholds* */
export function createDefaultRanks(companyId: Snowflake, roleIds: Snowflake[]) {
	return db.Ranks.bulkCreate(roleIds.map((roleId, index) => ({
		companyId,
		threshold: DEFAULT_VARIANCE_THRESHOLDS[index],
		roleId,
		rankmoji: DEFAULT_RANKMOJI[index]
	})));
}

export function createCustomRank(rawRank: { companyId: string, threshold: number, roleId?: string, rankmoji?: string }) {
	return db.Ranks.create(rawRank);
}

export function findOneRank(companyId: Snowflake, threshold: number) {
	return db.Ranks.findOne({ where: { companyId, threshold } });
}

/** *Finds all of a company's ranks and returns them in descending order* */
export function findAllRanks(companyId: Snowflake) {
	return db.Ranks.findAll({ where: { companyId }, order: [["threshold", "DESC"]] });
}

/** *Deletes the specified Ranks* */
export function deleteRanks(companyId: Snowflake, thresholds: number[]) {
	return db.Ranks.destroy({ where: { companyId, threshold: { [Op.in]: thresholds } } });
}

/** *Deletes all of a Company's Ranks* */
export function deleteCompanyRanks(companyId: Snowflake) {
	return db.Ranks.destroy({ where: { companyId } });
}
