const { Sequelize, Op } = require("sequelize");
const { GuildMember } = require("discord.js");
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
 * @param {number?} xpAwarded null for pending completion
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

/** *Get a Set with the userIds of the specified Bounty's hunters*
 * @param {string} bountyId
 */
async function getHunterIdSet(bountyId) {
	const completions = await db.models.Completion.findAll({ where: { bountyId } });
	return completions.reduce((set, completion) => set.add(completion.userId), new Set());
}

/** Filter out the Bounty's poster, bots, and banned Hunters
 * @param {Bounty} bounty
 * @param {GuildMember[]} completerMembers
 * @param {string} runMode
 */
async function checkTurnInEligibility(bounty, completerMembers, runMode) {
	/** @type {{ eligibleTurnInIds: Set<string>, newTurnInIds: Set<string>, bannedTurnInIds: Set<string> }} */
	const results = {
		eligibleTurnInIds: new Set(),
		newTurnInIds: new Set(),
		bannedTurnInIds: new Set()
	};
	for (const completion of await db.models.Completion.findAll({ where: { bountyId: bounty.id } })) {
		results.eligibleTurnInIds.add(completion.userId);
	}
	for (const member of completerMembers) {
		const memberId = member.id;
		if (results.eligibleTurnInIds.has(memberId)) continue;
		if (runMode === "production" && (member.user.bot || memberId === bounty.userId)) continue;
		await db.models.User.findOrCreate({ where: { id: memberId } });
		const [hunter] = await db.models.Hunter.findOrCreate({ where: { userId: memberId, companyId: bounty.companyId } });
		if (hunter.isBanned) {
			results.bannedTurnInIds.add(memberId);
			continue;
		}
		results.eligibleTurnInIds.add(memberId);
		results.newTurnInIds.add(memberId);
	}
	return results;
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
 * @param {Hunter} poster
 * @param {Map<string, Hunter>} validatedHunters
 * @param {Season} season
 * @param {Company} company
 */
async function completeBounty(bounty, poster, validatedHunters, season, company) {
	bounty.update({ state: "completed", completedAt: new Date() });

	const bountyBaseValue = Bounty.calculateCompleterReward(poster.getLevel(company.xpCoefficient), bounty.slotNumber, bounty.showcaseCount);
	const bountyValue = Math.floor(bountyBaseValue * company.festivalMultiplier);
	db.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });
	/** @type {Record<string, { previousLevel: number, droppedItem: string | null }>} */
	const hunterResults = {};
	for (const [hunterId, hunter] of validatedHunters) {
		hunterResults[hunterId] = { previousLevel: hunter.getLevel(company.xpCoefficient) };
		await hunter.increment({ othersFinished: 1, xp: bountyValue }).then(hunter => hunter.reload());
		const [itemRow, wasCreated] = await rollItemForHunter(1 / 8, hunter);
		hunterResults[hunterId].droppedItem = wasCreated ? itemRow.itemName : null;
		const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: bounty.companyId, userId: hunterId, seasonId: season.id }, defaults: { xp: bountyValue } });
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
	findEvergreenBounties,
	findBountyCompletions,
	getHunterIdSet,
	checkTurnInEligibility,
	findCompanyBountiesByCreationDate,
	findHuntersLastFiveBounties,
	completeBounty,
	deleteCompanyBounties,
	deleteSelectedBountyCompletions,
	deleteBountyCompletions
}
