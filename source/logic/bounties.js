const { Sequelize, Op } = require("sequelize");
const { Guild, GuildMember } = require("discord.js");
const { Bounty } = require("../models/bounties/Bounty");
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

/** *Create many Completions*
 * @param {{ bountyId: string, userId: string, companyId: string, xpAwarded?: number}[]} rawCompletions
 */
function bulkCreateCompletions(rawCompletions) {
	return db.models.Completion.bulkCreate(rawCompletions);
}

/**
 * @param {{slotNumber: number, posterId: string, guildId: string} | string} bountyInfo
 */
function findBounty(bountyInfo) {
	if (typeof bountyInfo === 'string') {
		return db.models.Bounty.findByPk(bountyInfo);
	} else {
		const { posterId: userId, guildId: companyId, slotNumber } = bountyInfo;
		return db.models.Bounty.findOne({ where: { userId, companyId, slotNumber, state: "open" } });
	}
}

/**
 * @param {string} userId
 * @param {string} companyId
 */
function findOpenBounties(userId, companyId) {
	return db.models.Bounty.findAll({ where: { userId, companyId, state: "open" }, order: [["slotNumber", "ASC"]] });
}

/** *Find a Hunter's Bounties in the slotNumbers*
 * @param {string} userId
 * @param {string} companyId
 * @param {number[]} slotNumbers
 */
function bulkFindOpenBounties(userId, companyId, slotNumbers) {
	return db.models.Bounty.findAll({ where: { userId, companyId, slotNumber: { [Op.in]: slotNumbers }, state: "open" } });
}

/** @param {string} companyId */
function findEvergreenBounties(companyId) {
	return db.models.Bounty.findAll({ where: { isEvergreen: true, companyId, state: "open" }, order: [["slotNumber", "ASC"]] });
}

/** @param {string} companyId */
function findCompanyBountiesByCreationDate(companyId) {
	return db.models.Bounty.findAll({ where: { companyId, state: "open" }, order: [["createdAt", "DESC"]] });
}

/**
 * @param {Bounty} bounty
 * @param {Guild} guild
 * @param {GuildMember[]} completerMembers
 * @param {string} runMode
 */
async function addCompleters(bounty, guild, completerMembers, runMode) {
	// Validate completer IDs
	const validatedCompleterIds = [];
	const existingCompletions = await db.models.Completion.findAll({ where: { bountyId: bounty.id, companyId: guild.id } });
	const existingCompleterIds = existingCompletions.map(completion => completion.userId);
	const bannedIds = [];
	for (const member of completerMembers.filter(member => !existingCompleterIds.includes(member.id))) {
		if (runMode === "production" && member.user.bot) continue;
		const memberId = member.id;
		await db.models.User.findOrCreate({ where: { id: memberId } });
		const [hunter] = await db.models.Hunter.findOrCreate({ where: { userId: memberId, companyId: guild.id } });
		if (hunter.isBanned) {
			bannedIds.push(memberId);
			continue;
		}
		existingCompleterIds.push(memberId);
		validatedCompleterIds.push(memberId);
	}

	if (validatedCompleterIds.length < 1) {
		throw `Could not find any new non-bot mentions in \`hunters\`.${bannedIds.length ? ' The completer(s) mentioned are currently banned.' : ''}`;
	}

	const rawCompletions = [];
	for (const userId of validatedCompleterIds) {
		rawCompletions.push({
			bountyId: bounty.id,
			userId,
			companyId: guild.id
		})
	}
	await bulkCreateCompletions(rawCompletions);
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
		company,
		validatedCompleterIds,
		bannedIds
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

/** *Delete the Completions (pending credit) of the specified Hunters on the specified Bounty*
 * @param {string} bountyId
 * @param {string[]} userIds
 */
function deleteSelectedBountyCompletions(bountyId, userIds) {
	return db.models.Completion.destroy({ where: { bountyId, userId: { [Op.in]: userIds } } });
}

/** *Delete all Completions associated with the specified Company*
 * @param {string} companyId
 */
function deleteCompanyCompletions(companyId) {
	return db.models.Completion.destroy({ where: { companyId } });
}

/** *Delete all Completions associated with the specified Bounty*
 * @param {string} bountyId
 */
function deleteBountyCompletions(bountyId) {
	return db.models.Completion.destroy({ where: { bountyId } });
}

module.exports = {
	setDB,
	bulkCreateCompletions,
	findBounty,
	findOpenBounties,
	bulkFindOpenBounties,
	findEvergreenBounties,
	findCompanyBountiesByCreationDate,
	addCompleters,
	completeBounty,
	deleteCompanyBounties,
	deleteSelectedBountyCompletions,
	deleteCompanyCompletions,
	deleteBountyCompletions
}
