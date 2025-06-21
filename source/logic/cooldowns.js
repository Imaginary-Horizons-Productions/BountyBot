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
	const allInteractions = await db.models.UserInteraction.findOne({ where: { userId }, order: [[ "cooldownTime", "DESC" ]] });
	const gcdCooldown = !allInteractions ? new Date(0) : new Date(allInteractions.lastInteractTime.getTime() + GLOBAL_COMMAND_COOLDOWN);
	if (gcdCooldown > interactionTime) {
		return {
			isOnGeneralCooldown: true,
			isOnCommandCooldown: false,
			cooldownTimestamp: gcdCooldown,
			lastCommandName: allInteractions.interactionName
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
	const thisInteractions = await db.models.UserInteraction.findOne({ where: { userId, interactionName } , order: [[ "cooldownTime", "DESC" ]]});
	if (thisInteractions && thisInteractions.cooldownTime && thisInteractions.cooldownTime > interactionTime) {
		thisInteractions.increment("hitTimes");
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
	const [interaction, wasCreated] = await db.models.UserInteraction.findOrCreate({ where: { userId, interactionName } });
	interaction.lastInteractTime = interactionTime;
	if (wasCreated) {
		interaction.interactionTime = interactionTime;
	}
	if (wasCreated || interaction.cooldownTime <= interactionTime) { // Only update the cooldown if it is currently off cooldown or new
		interaction.cooldownTime = new Date(interactionTime.getTime() + interactionCooldown);
	}
	interaction.save();
}

/**
 * Clean cooldown data. Intended to be run periodically.
 */
async function cleanCooldownData() {
	await db.models.UserInteraction.destroy({ where: {
		cooldownTime: {
			[Op.lt] : dateInPast({ d: 1 })
		}
	} });
}

module.exports = {
	setDB,
	checkCooldownState,
	checkCommandCooldownState,
	updateCooldowns,
	cleanCooldownData
}
