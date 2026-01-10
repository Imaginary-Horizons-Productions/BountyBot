const { Sequelize, Op } = require("sequelize");
const { dateInPast } = require("../shared");
const { GLOBAL_COMMAND_COOLDOWN } = require("../constants");

/** @type {Sequelize} */
let db;

function setDB(database) {
	db = database;
}

/**
 * Check all cooldown information based on the given user, intraction, and interaction time.
 * @param {string} userId
 * @param {string} interactionName
 * @param {Date} interactionTime
 * @returns {Promise<{isOnGeneralCooldown: boolean, isOnCommandCooldown: boolean, cooldownTimestamp?: Date, lastCommandName?: string}>}
 */
async function checkCooldownState(userId, interactionName, interactionTime) {
	const latestCooldown = await db.models.UserInteraction.findOne({ where: { userId }, order: [["cooldownTime", "DESC"]] });
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


/**
 * Check cooldown information for a given command/item based on the given user, intraction, and interaction time.
 * @param {string} userId
 * @param {string} interactionName
 * @param {Date} interactionTime
 * @returns {Promise<{isOnGeneralCooldown: boolean, isOnCommandCooldown: boolean, cooldownTimestamp?: Date, lastCommandName?: string}>}
 */
async function checkCommandCooldownState(userId, interactionName, interactionTime) {
	const thisInteractions = await db.models.UserInteraction.findOne({ where: { userId, interactionName }, order: [["cooldownTime", "DESC"]] });
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
 * @param {string} userId
 * @param {string} interactionName
 * @param {Date} interactionTime
 * @param {Date} interactionCooldown
 */
async function updateCooldowns(userId, interactionName, interactionTime, interactionCooldown) {
	const cooldownTime = new Date(interactionTime.getTime() + interactionCooldown);
	const userInteraction = await db.models.UserInteraction.findOne({ where: { userId, interactionName } });
	if (!userInteraction) {
		return db.models.UserInteraction.create({ userId, interactionName, interactionTime, lastInteractTime: interactionTime, cooldownTime: cooldownTime });
	}

	const updateValues = { lastInteractTime: interactionTime };
	if (userInteraction.cooldownTime <= interactionTime) {
		// Only update the cooldown if it is currently off cooldown
		updateValues.cooldownTime = cooldownTime;
	}
	return userInteraction.update(updateValues);
}

/**
 * Clean cooldown data. Intended to be run periodically.
 */
function cleanCooldownData() {
	return db.models.UserInteraction.destroy({
		where: {
			cooldownTime: {
				[Op.lt]: dateInPast({ d: 1 })
			}
		}
	});
}

module.exports = {
	setDB,
	checkCooldownState,
	checkCommandCooldownState,
	updateCooldowns,
	cleanCooldownData
}
