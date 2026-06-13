import { GuildMember, Snowflake } from "discord.js";
import { Op } from "sequelize";
import { Database, DatabaseTypes } from "../database";
import { rollItemForHunter } from "./items";

let db: Database;

export function setDB(database: Database) {
	db = database;
}

export function createBounty(rawBounty: { userId: string, companyId: string, slotNumber: number, isEvergreen: boolean, title: string }) {
	return db.Bounties.create(rawBounty);
}

/** *Create Completions for multiple Hunters for the same Bounty* */
export function bulkCreateCompletions(bountyId: string, companyId: Snowflake, userIds: Snowflake[], xpAwarded?: number) {
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
	return db.Completions.bulkCreate(rawCompletions);
}

export function findBounty(bountyInfo: { slotNumber: number, userId: string, companyId: string } | string) {
	if (typeof bountyInfo === 'string') {
		return db.Bounties.findByPk(bountyInfo);
	} else {
		return db.Bounties.findOne({ where: { ...bountyInfo, state: "open" } });
	}
}

export function findOpenBounties(userId: Snowflake, companyId: Snowflake) {
	return db.Bounties.findAll({ where: { userId, companyId, state: "open" }, order: [["slotNumber", "ASC"]] });
}

export async function mapOpenBountiesBySlotNumber(userId: Snowflake, companyId: Snowflake) {
	const bountyMap = new Map<number, DatabaseTypes.Bounty>();
	for (const bounty of await db.Bounties.findAll({ where: { userId, companyId, state: "open" } })) {
		bountyMap.set(bounty.slotNumber, bounty);
	}
	return bountyMap;
}

export function findEvergreenBounties(companyId: Snowflake) {
	return db.Bounties.findAll({ where: { isEvergreen: true, companyId, state: "open" }, order: [["slotNumber", "ASC"]] });
}

/** *Find all Completions associated with the specified Bounty* */
export function findBountyCompletions(bountyId: string) {
	return db.Completions.findAll({ where: { bountyId } });
}

/** *Get a Set with the userIds of the specified Bounty's hunters* */
export async function getHunterIdSet(bountyId: string) {
	const completions = await db.Completions.findAll({ where: { bountyId } });
	return completions.reduce((set, completion) => set.add(completion.userId), new Set());
}

/** Filter out the Bounty's poster, bots, and banned Hunters */
export async function checkTurnInEligibility(bounty: DatabaseTypes.Bounty, completerMembers: GuildMember[], isDevMode: boolean) {
	/** @type {{ eligibleTurnInIds: Set<string>, newTurnInIds: Set<string>, bannedTurnInIds: Set<string> }} */
	const results = {
		eligibleTurnInIds: new Set(),
		newTurnInIds: new Set(),
		bannedTurnInIds: new Set()
	};
	for (const completion of await db.Completions.findAll({ where: { bountyId: bounty.id } })) {
		results.eligibleTurnInIds.add(completion.userId);
	}
	for (const member of completerMembers) {
		const memberId = member.id;
		if (results.eligibleTurnInIds.has(memberId)) continue;
		if (!isDevMode && (member.user.bot || memberId === bounty.userId)) continue;
		await db.Users.findOrCreate({ where: { id: memberId } });
		const [hunter] = await db.Hunters.findOrCreate({ where: { userId: memberId, companyId: bounty.companyId } });
		if (hunter.isBanned) {
			results.bannedTurnInIds.add(memberId);
			continue;
		}
		results.eligibleTurnInIds.add(memberId);
		results.newTurnInIds.add(memberId);
	}
	return results;
}

export function findCompanyBountiesByCreationDate(companyId: Snowflake) {
	return db.Bounties.findAll({ where: { companyId, state: "open" }, order: [["createdAt", "DESC"]] });
}

/** *Finds a Hunter's last five bounties for the purpose of making a moderation user report* */
export function findHuntersLastFiveBounties(userId: Snowflake, companyId: Snowflake) {
	return db.Bounties.findAll({ where: { userId, companyId, state: "completed" }, order: [["completedAt", "DESC"]], limit: 5, include: db.models.Bounty.Completions });
}

export async function completeBounty(bounty: DatabaseTypes.Bounty, poster: DatabaseTypes.Hunter, validatedHunters: Map<string, DatabaseTypes.Hunter>, season: DatabaseTypes.Season, company: DatabaseTypes.Company) {
	const hunterReceipts = new Map();
	bounty.update({ state: "completed", completedAt: new Date() });

	const bountyBaseValue = DatabaseTypes.Bounty.calculateCompleterReward(poster.getLevel(company.xpCoefficient), bounty.slotNumber, bounty.showcaseCount);
	const bountyValue = Math.floor(bountyBaseValue * company.xpFestivalMultiplier);
	db.Completions.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });
	const xpMultiplierString = company.festivalMultiplierString("xp");
	for (const [hunterId, hunter] of validatedHunters) {
		const hunterReceipt = {};
		const previousHunterLevel = hunter.getLevel(company.xpCoefficient);
		const updatedHunter = await hunter.increment({ othersFinished: 1, xp: bountyValue }).then(hunter => hunter.reload());
		hunterReceipt.xp = bountyBaseValue;
		hunterReceipt.xpMultiplier = xpMultiplierString;
		const currentHunterLevel = updatedHunter.getLevel(company.xpCoefficient);
		if (currentHunterLevel > previousHunterLevel) {
			hunterReceipt.levelUp = { achievedLevel: currentHunterLevel, previousLevel: previousHunterLevel };
		}
		const [itemRow, wasCreated] = await rollItemForHunter(1 / 8, hunter);
		if (wasCreated) {
			hunterReceipt.item = itemRow.itemName;
		}
		const [participation, participationCreated] = await db.Participations.findOrCreate({ where: { companyId: bounty.companyId, userId: hunterId, seasonId: season.id }, defaults: { xp: bountyValue } });
		if (!participationCreated) {
			participation.increment({ xp: bountyValue });
		}
		hunterReceipts.set(hunterId, hunterReceipt);
	}

	const posterReceipt = { title: "Bounty Poster" };
	const posterXP = bounty.calculatePosterReward(validatedHunters.size);
	const previousPosterLevel = poster.getLevel(company.xpCoefficient);
	poster = await poster.increment({ mineFinished: 1, xp: posterXP * company.xpFestivalMultiplier }).then(poster => poster.reload());
	posterReceipt.xp = posterXP;
	posterReceipt.xpMultiplier = xpMultiplierString;
	const currentPosterLevel = poster.getLevel(company.xpCoefficient);
	if (currentPosterLevel > previousPosterLevel) {
		posterReceipt.levelUp = { achievedLevel: currentPosterLevel, previousLevel: previousPosterLevel };
	}
	const [itemRow, wasCreated] = await rollItemForHunter(1 / 4, poster);
	if (wasCreated) {
		posterReceipt.item = itemRow.itemName;
	}
	hunterReceipts.set(poster.userId, posterReceipt);
	const [participation, participationCreated] = await db.Participations.findOrCreate({ where: { companyId: bounty.companyId, userId: bounty.userId, seasonId: season.id }, defaults: { xp: posterXP * company.xpFestivalMultiplier, postingsCompleted: 1 } });
	if (!participationCreated) {
		participation.increment({ xp: posterXP * company.xpFestivalMultiplier, postingsCompleted: 1 });
	}

	return hunterReceipts;
}

/** *Delete all Bounties and Completions associated with the given Company* */
export async function deleteCompanyBounties(companyId: Snowflake) {
	await db.Completions.destroy({ where: { companyId } });
	return db.Bounties.destroy({ where: { companyId } });
}

/** *Deletes all Bounties and Completions associated with the given Company by the given User, then return the Snowflakes of the deleted bounties's postings* */
export async function deleteHunterBountiesAndCompletionsFromCompany(userId: Snowflake, companyId: Snowflake) {
	const bountyPostingIds = [];
	for (const bounty of await db.Bounties.findAll({ where: { userId, companyId } })) {
		await db.Completions.destroy({ where: { bountyId: bounty.id } });
		if (bounty.postingId) {
			bountyPostingIds.push(bounty.postingId);
		}
		await bounty.destroy();
	}
	await db.Completions.destroy({ where: { userId, companyId } });
	return bountyPostingIds;
}

/** *Delete the Completions (pending credit) of the specified Hunters on the specified Bounty* */
export function deleteSelectedBountyCompletions(bountyId: string, userIds: Snowflake[]) {
	return db.Completions.destroy({ where: { bountyId, userId: { [Op.in]: userIds } } });
}

/** *Delete all Completions associated with the specified Bounty* */
export function deleteBountyCompletions(bountyId: string) {
	return db.Completions.destroy({ where: { bountyId } });
}
