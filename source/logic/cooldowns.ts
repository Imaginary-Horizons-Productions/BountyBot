import { Snowflake } from "discord.js";
import { Op } from "sequelize";
import { Database } from "../database/index.ts";
import { dateInPast } from "../shared";
import { GLOBAL_COMMAND_COOLDOWN } from "../shared/constants.ts";

let db: Database;

export function setDB(database: Database) {
	db = database;
}

/** Check all cooldown information based on the given user, interaction, and interaction time. */
export async function checkCooldownState(userId: Snowflake, interactionName: string, interactionTime: Date) {
	const latestCooldown = await db.UserInteractions.findOne({ where: { userId }, order: [["cooldownTime", "DESC"]] });
	const gcdCooldown = !latestCooldown ? new Date(0) : new Date(latestCooldown.lastInteractTime.getTime() + GLOBAL_COMMAND_COOLDOWN);
	if (gcdCooldown > interactionTime) {
		return {
			isOnGeneralCooldown: true,
			isOnCommandCooldown: false,
			cooldownTimestamp: gcdCooldown,
			lastCommandName: latestCooldown.interactionName
		};
	}
	return checkCommandCooldownState(userId, interactionName, interactionTime);
}


/** Check cooldown information for a given command/item based on the given user, interaction, and interaction time. */
export async function checkCommandCooldownState(userId: Snowflake, interactionName: string, interactionTime: Date) {
	const thisInteractions = await db.UserInteractions.findOne({ where: { userId, interactionName }, order: [["cooldownTime", "DESC"]] });
	if (thisInteractions && thisInteractions.cooldownTime && thisInteractions.cooldownTime > interactionTime) {
		return {
			isOnGeneralCooldown: false,
			isOnCommandCooldown: true,
			cooldownTimestamp: thisInteractions.cooldownTime,
			lastCommandName: interactionName
		};
	}
	return {
		isOnGeneralCooldown: false,
		isOnCommandCooldown: false
	};
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

	const updateValues = { lastInteractTime: interactionTime };
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
