const { Sequelize } = require("sequelize");
const { Guild } = require("discord.js");
const { Bounty } = require("../models/bounties/Bounty");
const { Company } = require("../models/companies/Company");
const { Hunter } = require("../models/users/Hunter");
const { rollItemDrop } = require("../util/itemUtil");

/** @type {Sequelize} */
let db;

/**
 * Set the database pointer for this logic file.
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/**
 * @param {string} userId
 * @param {string} companyId
 */
function findOpenBounties(userId, companyId) {
	return db.models.Bounty.findAll({ where: { userId, companyId, state: "open" }, order: [["slotNumber", "ASC"]] });
}

/** @param {string} companyId */
function findEvergreenBounties(companyId) {
	return db.models.Bounty.findAll({ where: { isEvergreen: true, companyId, state: "open" }, order: [["slotNumber", "ASC"]] });
}

/**
 * @param {Guild} guild
 * @param {Bounty} bounty
 * @param {Company} company
 * @param {string[]} completerIds
 */
async function addCompleters(guild, bounty, completerIds) {
	const rawCompletions = [];
	for (const userId of completerIds) {
		rawCompletions.push({
			bountyId: bounty.id,
			userId,
			companyId: guild.id
		})
	}
	await db.models.Completion.bulkCreate(rawCompletions);
	let allCompleters = await db.models.Completion.findAll({
		where: {
			bountyId: bounty.id
		}
	});
	let poster = await db.models.Hunter.findOne({
		where: {
			userId: bounty.userId,
			companyId: bounty.companyId
		}
	});
	let company = await db.models.Company.findByPk(bounty.companyId);
	return {
		bounty,
		allCompleters,
		poster,
		company
	};
}

/**
 * @param {Bounty} bounty
 * @param {Hunter} poster
 * @param {Hunter[]} validatedHunters
 * @param {Guild} guild
 */
async function completeBounty(bounty, poster, validatedHunters, guild) {
	bounty.update({ state: "completed", completedAt: new Date() });
	const rewardTexts = [];

	const bountyBaseValue = Bounty.calculateCompleterReward(poster.level, bounty.slotNumber, bounty.showcaseCount);
	const company = await db.models.Company.findByPk(bounty.companyId);
	const bountyValue = bountyBaseValue * company.festivalMultiplier;
	db.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });
	for (const hunter of validatedHunters) {
		const completerLevelTexts = await hunter.addXP(guild.name, bountyValue, true, company);
		if (completerLevelTexts.length > 0) {
			rewardTexts.push(...completerLevelTexts);
		}
		hunter.increment("othersFinished");
		const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: bounty.companyId, userId: hunter.userId, seasonId: season.id }, defaults: { xp: bountyValue } });
		if (!participationCreated) {
			participation.increment({ xp: bountyValue });
		}
		let dropRate = 1 / 8;
		if (hunter.itemFindBoost) {
			dropRate *= 2;
			hunter.update("itemFindBoost", false);
		}
		const droppedItem = rollItemDrop(dropRate);
		if (droppedItem) {
			const [itemRow, itemWasCreated] = await db.models.Item.findOrCreate({ where: { userId: hunter.userId, itemName: droppedItem } });
			if (!itemWasCreated) {
				itemRow.increment("count");
			}
			rewardTexts.push(`<@${hunter.userId}> has found a **${droppedItem}**!`);
		}
	}

	const posterXP = bounty.calculatePosterReward(validatedHunters.length);
	const posterLevelTexts = await poster.addXP(guild.name, posterXP * company.festivalMultiplier, true, company);
	if (posterLevelTexts.length > 0) {
		rewardTexts.push(...posterLevelTexts);
	}
	poster.increment("mineFinished");
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: bounty.companyId, userId: bounty.userId, seasonId: season.id }, defaults: { xp: posterXP * company.festivalMultiplier, postingsCompleted: 1 } });
	if (!participationCreated) {
		participation.increment({ xp: posterXP * company.festivalMultiplier, postingsCompleted: 1 });
	}
	let dropRate = 1 / 4;
	if (poster.itemFindBoost) {
		dropRate *= 2;
		poster.update("itemFindBoost", false);
	}
	const droppedItem = rollItemDrop(dropRate);
	if (droppedItem) {
		const [itemRow, itemWasCreated] = await db.models.Item.findOrCreate({ where: { userId: bounty.userId, itemName: droppedItem } });
		if (!itemWasCreated) {
			itemRow.increment("count");
		}
		rewardTexts.push(`<@${poster.userId}> has found a **${droppedItem}**!`);
	}

	return {
		completerXP: bountyBaseValue,
		posterXP,
		rewardTexts
	};
}

/** *Delete all Bounties associated with the given Company*
 * @param {string} companyId
 */
function deleteCompanyBounties(companyId) {
	return db.models.Bounty.destroy({ where: { companyId } });
}

module.exports = {
	setDB,
	findOpenBounties,
	findEvergreenBounties,
	addCompleters,
	completeBounty,
	deleteCompanyBounties
}
