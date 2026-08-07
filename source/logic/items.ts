import { Snowflake } from "discord.js";
import { Op } from "sequelize";
import { Database, DatabaseTypes } from "../database";
import { dateInPast } from "../shared";
import { premium } from "../shared/constants.ts";

let db: Database;

/** *Set the database pointer for the Item logic file* */
export function setDB(database: Database) {
	db = database;
}

export async function getInventory(userId: Snowflake) {
	const inventoryMap = new Map<string, number>();
	for (const item of await db.Items.findAll({ where: { userId, used: false } })) {
		const itemCount = inventoryMap.get(item.itemName);
		if (itemCount !== undefined) {
			inventoryMap.set(item.itemName, itemCount + 1);
		} else {
			inventoryMap.set(item.itemName, 1);
		}
	}
	return inventoryMap;
}


/** pool picker range: 0-120
 *
 * key as theshold to get to pool defined by string array
 */
const DROP_TABLE = {
	70: [
		"Bonus Bounty Showcase",
		"Bounty Thumbnail",
		"Goal Initializer",
		"Progress-in-a-Can",
		"XP Boost"
	],
	0: [
		"Aqua Profile Colorizer",
		"Blue Profile Colorizer",
		"Blurple Profile Colorizer",
		"Dark Aqua Profile Colorizer",
		"Dark Blue Profile Colorizer",
		"Dark But Not Black Profile Colorizer",
		"Darker Grey Profile Colorizer",
		"Dark Gold Profile Colorizer",
		"Dark Green Profile Colorizer",
		"Dark Grey Profile Colorizer",
		"Dark Navy Profile Colorizer",
		"Dark Orange Profile Colorizer",
		"Dark Purple Profile Colorizer",
		"Dark Red Profile Colorizer",
		"Dark Vivid Pink Profile Colorizer",
		"Default Profile Colorizer",
		"Fuchsia Profile Colorizer",
		"Gold Profile Colorizer",
		"Green Profile Colorizer",
		"Grey Profile Colorizer",
		"Greyple Profile Colorizer",
		"Light Grey Profile Colorizer",
		"Luminous Vivid Pink Profile Colorizer",
		"Orange Profile Colorizer",
		"Purple Profile Colorizer",
		"Red Profile Colorizer",
		"White Profile Colorizer",
		"Yellow Profile Colorizer",
	]
};

export async function getDropsAvailable(hunterId: Snowflake) {
	const itemCutoff = premium.gift.concat(premium.paid).includes(hunterId) ? 4 : 2;
	const itemsDropped = await db.Items.count({ where: { userId: hunterId, createdAt: { [Op.gt]: dateInPast({ 'd': 1 }) } } });
	return itemCutoff - itemsDropped;
}

/** *If `dropRate` (decimal probability) succeeds, grants `hunter` 1 copy of a random Item* */
export async function rollItemForHunter(dropRate: number, hunter: DatabaseTypes.Hunter) {
	if (hunter.itemFindBoost) {
		dropRate *= 2;
		hunter.update("itemFindBoost", false);
	}

	if (Math.random() < dropRate) {
		const poolThresholds = Object.keys(DROP_TABLE).map(unparsed => parseFloat(unparsed)).sort((a, b) => b - a) as (keyof typeof DROP_TABLE)[];
		const poolRandomNumber = Math.random() * 120;
		for (const threshold of poolThresholds) {
			if (poolRandomNumber > threshold) {
				const pool = DROP_TABLE[threshold];
				return db.Items.create({ userId: hunter.userId, itemName: pool[Math.floor(Math.random() * pool.length)] })
			}
		}
	}
	return null;
}

/** *Grants the User 1 copy of a random Item without consuming itemFindBoost * */
export function createRandomItem(hunter: DatabaseTypes.Hunter) {
	const poolRandomNumber = Math.random() * 120;
	let pool: string[] = [];
	for (const [threshold, poolCandidate] of Object.entries(DROP_TABLE)) {
		if (poolRandomNumber > parseFloat(threshold)) {
			pool = poolCandidate;
			break;
		}
	}
	return db.Items.create({ userId: hunter.userId, itemName: pool[Math.floor(Math.random() * pool.length)] });
}

/** *Finds the count of the specified Items of User* */
export function countUserCopies(userId: Snowflake, itemName: string) {
	return db.Items.count({ where: { userId, itemName, used: false } });
}

/** *Sets the oldest `count` of the specified Items of User to used*
 *
 * count validation for sufficient existing item count is assumed to already have been done
*/
export async function consume(userId: Snowflake, itemName: string, count: number) {
	const rows = await db.Items.findAll({ where: { userId, itemName, used: false }, order: [["createdAt", "ASC"]], limit: count });
	for (const row of rows) {
		await row.update("used", true);
	}
	return rows;
}

/** Destroy used items to reduce table size and obfuscate id generation */
export function sweepUsed() {
	return db.Items.destroy({ where: { used: true } });
}
