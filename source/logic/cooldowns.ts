import { Snowflake } from "discord.js";
import { Op } from "sequelize";
import { Database, DatabaseTypes } from "../database/index.ts";
import { dateInPast } from "../shared";
import { GLOBAL_COMMAND_COOLDOWN } from "../shared/constants.ts";

let db: Database;

export function setDB(database: Database) {
	db = database;
}

export async function checkGlobalCooldonwForUser(userId: Snowflake, now: Date) {
	const latestUserInteraction = await db.UserInteractions.findOne({ where: { userId }, order: [["cooldownTime", "DESC"]] });
	if (latestUserInteraction) {
		const endOfCD = new Date(latestUserInteraction.lastInteractTime.getTime() + GLOBAL_COMMAND_COOLDOWN);
		return {
			endOfCD,
			isOnCD: endOfCD <= now,
			lastCommandName: latestUserInteraction.interactionName
		};
	} else {
		return { endOfCD: null, isOnCD: false, lastCommandName: null } as const;
	}
}

export async function checkSpecificCooldownForUser(userId: Snowflake, interactionName: string, now: Date) {
	const latestSpecificUserInteraction = await db.UserInteractions.findOne({ where: { userId, interactionName }, order: [["cooldownTime", "DESC"]] });
	if (latestSpecificUserInteraction) {
		return {
			endOfCD: latestSpecificUserInteraction.cooldownTime,
			isOnCD: latestSpecificUserInteraction.cooldownTime <= now
		}
	} else {
		return { endOfCD: null, isOnCD: false } as const;
	}
}

/**
 * Update cooldown information based on known interaction information.
 * Should be run after all relevant cooldown information has been checked independently using checkCooldownState.
 */
export async function updateCooldowns(userId: Snowflake, interactionName: string, interactionTime: Date, cooldownInMS: number) {
	const cooldownTime = new Date(interactionTime.getTime() + cooldownInMS);
	const userInteraction = await db.UserInteractions.findOne({ where: { userId, interactionName } });
	if (!userInteraction) {
		return db.UserInteractions.create({ userId, interactionName, interactionTime, lastInteractTime: interactionTime, cooldownTime: cooldownTime });
	}

	const updateValues: Partial<DatabaseTypes.UserInteraction> = { lastInteractTime: interactionTime };
	if (userInteraction.cooldownTime <= interactionTime) {
		// Only update the cooldown if it is currently off cooldown
		updateValues.cooldownTime = cooldownTime;
	}
	return userInteraction.update(updateValues);
}

/** Clean cooldown data. Intended to be run periodically. */
export function cleanCooldownData() {
	return db.UserInteractions.destroy({
		where: {
			cooldownTime: {
				[Op.lt]: dateInPast({ d: 1 })
			}
		}
	});
}
