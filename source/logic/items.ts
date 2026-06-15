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

/** *Grants the User 1 copy of a random Item at a rate of dropRate*
 *
 * dropRate is a decimal representing the probability
 */
export async function rollItemForHunter(dropRate: number, hunter: DatabaseTypes.Hunter) {
	if (hunter.itemFindBoost) {
		dropRate *= 2;
		hunter.update("itemFindBoost", false);
	}

	let droppedItem;
	if (Math.random() < dropRate) {
		const poolThresholds = Object.keys(DROP_TABLE).map(unparsed => parseFloat(unparsed)).sort((a, b) => b - a) as (keyof typeof DROP_TABLE)[];
		const poolRandomNumber = Math.random() * 120;
		for (const threshold of poolThresholds) {
			if (poolRandomNumber > threshold) {
				const pool = DROP_TABLE[threshold];
				droppedItem = pool[Math.floor(Math.random() * pool.length)];
			}
		}
	}
	return droppedItem ? await db.Items.create({ userId: hunter.userId, itemName: droppedItem }) : null;
}

/** *Finds the count of the specified Items of User* */
export function countUserCopies(userId: Snowflake, itemName: string) {
	return db.Items.count({ where: { userId, itemName, used: false } });
}

/** *Sets the oldest of the specified Items of User to used*
 *
 * Assumes item is extent
 */
export async function consume(userId: Snowflake, itemName: string) {
	const dbRow = await db.Items.findOne({ where: { userId, itemName, used: false }, order: [["createdAt", "ASC"]] });
	if (!dbRow) {
		throw new Error(`Attempted to consume non-existant item ${itemName} for user with id ${userId}`);
	}
	return dbRow.update("used", true);
}

/** Destroy used items to reduce table size and obfuscate id generation */
export function sweepUsed() {
	return db.Items.destroy({ where: { used: true } });
}
