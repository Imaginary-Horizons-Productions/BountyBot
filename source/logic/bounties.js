const { Sequelize, Op } = require("sequelize");
const { Guild, GuildMember } = require("discord.js");
const { Bounty, Hunter, Season, Company } = require("../database/models");
const { rollItemForHunter } = require("./items");

/** @type {Sequelize} */
let db;

/**
 * Set the database pointer for this logic file.
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** @param {{ userId: string, companyId: string, slotNumber: number, isEvergreen: boolean, title: string }} rawBounty */
function createBounty(rawBounty) {
	return db.models.Bounty.create(rawBounty);
}

/** *Create Completions for multiple Hunters for the same Bounty*
 * @param {string} bountyId
 * @param {string} companyId
 * @param {string[]} userIds
 * @param {number?} xpAwarded
 */
function bulkCreateCompletions(bountyId, companyId, userIds, xpAwarded) {
	const rawCompletions = userIds.map(id => {
		const rawCompletion = {
			bountyId,
			userId: id,
			companyId
		};
		if (xpAwarded) {
			rawCompletion.xpAwarded = xpAwarded;
		}
		return rawCompletion;
	});
	return db.models.Completion.bulkCreate(rawCompletions);
}

/**
 * @param {{slotNumber: number, userId: string, companyId: string} | string} bountyInfo
 */
function findBounty(bountyInfo) {
	if (typeof bountyInfo === 'string') {
		return db.models.Bounty.findByPk(bountyInfo);
	} else {
		return db.models.Bounty.findOne({ where: { ...bountyInfo, state: "open" } });
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

/** *Find all Completions associated with the specified Bounty*
 * @param {string} bountyId
 */
function findBountyCompletions(bountyId) {
	return db.models.Completion.findAll({ where: { bountyId } });
}

/** @param {string} companyId */
function findCompanyBountiesByCreationDate(companyId) {
	return db.models.Bounty.findAll({ where: { companyId, state: "open" }, order: [["createdAt", "DESC"]] });
}

/** *Finds a Hunter's last five bounties for the purpose of making a moderation user report*
 * @param {string} userId
 * @param {string} companyId
 */
function findHuntersLastFiveBounties(userId, companyId) {
	return db.models.Bounty.findAll({ where: { userId, companyId, state: "completed" }, order: [["completedAt", "DESC"]], limit: 5, include: db.models.Bounty.Completions });
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
		const memberId = member.id;
		if (runMode === "production" && (member.user.bot || memberId === bounty.userId)) continue;
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
		throw `No new turn-ins were able to be recorded. You cannot credit yourself or bots for your own bounties. ${bannedIds.length ? ' The completer(s) mentioned are currently banned.' : ''}`;
	}

	await bulkCreateCompletions(bounty.id, guild.id, validatedCompleterIds, null);
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
 * @param {Season} season
 * @param {Company} company
 */
async function completeBounty(bounty, poster, validatedHunters, season, company) {
	bounty.update({ state: "completed", completedAt: new Date() });

	const bountyBaseValue = Bounty.calculateCompleterReward(poster.getLevel(company.xpCoefficient), bounty.slotNumber, bounty.showcaseCount);
	const bountyValue = bountyBaseValue * company.festivalMultiplier;
	db.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });
	/** @type {Record<string, { previousLevel: number, droppedItem: string | null }>} */
	const hunterResults = {};
	for (const hunter of validatedHunters) {
		hunterResults[hunter.userId] = { previousLevel: hunter.getLevel(company.xpCoefficient) };
		await hunter.increment({ othersFinished: 1, xp: bountyValue }).then(hunter => hunter.reload());
		const [itemRow, wasCreated] = await rollItemForHunter(1 / 8, hunter);
		hunterResults[hunter.userId].droppedItem = wasCreated ? itemRow.itemName : null;
		const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: bounty.companyId, userId: hunter.userId, seasonId: season.id }, defaults: { xp: bountyValue } });
		if (!participationCreated) {
			participation.increment({ xp: bountyValue });
		}
	}

	const posterXP = bounty.calculatePosterReward(validatedHunters.length);
	hunterResults[poster.userId] = { previousLevel: poster.getLevel(company.xpCoefficient) };
	await poster.increment({ mineFinished: 1, xp: posterXP * company.festivalMultiplier }).then(poster => poster.reload());
	const [itemRow, wasCreated] = await rollItemForHunter(1 / 4, poster);
	hunterResults[poster.userId].droppedItem = wasCreated ? itemRow.itemName : null;
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: bounty.companyId, userId: bounty.userId, seasonId: season.id }, defaults: { xp: posterXP * company.festivalMultiplier, postingsCompleted: 1 } });
	if (!participationCreated) {
		participation.increment({ xp: posterXP * company.festivalMultiplier, postingsCompleted: 1 });
	}

	return {
		completerXP: bountyBaseValue,
		posterXP,
		hunterResults
	};
}

/** *Delete all Bounties and Completions associated with the given Company*
 * @param {string} companyId
 */
async function deleteCompanyBounties(companyId) {
	await db.models.Completion.destroy({ where: { companyId } });
	return db.models.Bounty.destroy({ where: { companyId } });
}

/** *Delete the Completions (pending credit) of the specified Hunters on the specified Bounty*
 * @param {string} bountyId
 * @param {string[]} userIds
 */
function deleteSelectedBountyCompletions(bountyId, userIds) {
	return db.models.Completion.destroy({ where: { bountyId, userId: { [Op.in]: userIds } } });
}

/** *Delete all Completions associated with the specified Bounty*
 * @param {string} bountyId
 */
function deleteBountyCompletions(bountyId) {
	return db.models.Completion.destroy({ where: { bountyId } });
}

module.exports = {
	setDB,
	createBounty,
	bulkCreateCompletions,
	findBounty,
	findOpenBounties,
	bulkFindOpenBounties,
	findEvergreenBounties,
	findBountyCompletions,
	findCompanyBountiesByCreationDate,
	findHuntersLastFiveBounties,
	addCompleters,
	completeBounty,
	deleteCompanyBounties,
	deleteSelectedBountyCompletions,
	deleteBountyCompletions
}
