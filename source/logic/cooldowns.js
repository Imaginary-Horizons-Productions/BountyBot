// const { Guild, GuildMember } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { dateInPast } = require("../util/textUtil");
// const { UserInteraction } = require("../models/users/UserInteraction");
const { GLOBAL_COMMAND_COOLDOWN } = require("../constants");

/** @type {Sequelize} */
let db;

function setDB(database) {
	db = database;
}

async function checkCooldownState(userId, interactionName, interactionTime) {
	const allInteractions = await db.models.UserInteraction.findOne({ where: { userId }, order: [[ "cooldownTime", "DESC" ]] });
	if (allInteractions && allInteractions.interactionTime + GLOBAL_COMMAND_COOLDOWN < interactionTime) {
		return {
			isOnGeneralCooldown: true,
			isOnCommandCooldown: false,
			cooldownTimestamp: allInteractions.interactionTime + GCD,
			lastCommandName: allInteractions.interactionName
		};
	}
	const thisInteractions = await db.models.UserInteraction.findOne({ where: { userId, interactionName } , order: [[ "cooldownTime", "DESC" ]]});
	if (thisInteractions && thisInteractions.cooldownTime < interactionTime) {
		return {
			isOnGeneralCooldown: false,
			isOnCommandCooldown: true,
			cooldownTimestamp: thisInteractions.cooldownTime,
			lastCommandName: interactionName
		};
	}
}

async function updateCooldowns(userId, interactionName, interactionTime, interactionCooldown) {
	const [interaction, wasCreated] = await db.models.UserInteraction.findOrCreate({ where: { userId, interactionName } });
	interaction.lastInteractTime = interactionTime;
	if (wasCreated) {
		interaction.interactionTime = interactionTime;
		interaction.cooldownTime = interactionTime + interactionCooldown;
	} else {
		interaction.increment("hitTimes");
	}
}

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
	updateCooldowns,
	cleanCooldownData
}
