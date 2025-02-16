const { Sequelize } = require("sequelize");
const { userMention, Guild, GuildMember } = require("discord.js");
const { Bounty } = require("../models/bounties/Bounty");
const { Company } = require("../models/companies/Company");
const { Hunter } = require("../models/users/Hunter");
const { progressGoal } = require("./goals");
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
 * @param {Guild} guild
 * @param {Bounty} bounty
 * @param {Company} company
 * @param {GuildMember[]} completerMembers
 * @param {string} runMode
 */
async function addCompleters({slotNumber, posterId, bountyId}, guild, completerMembers, runMode) {
	// Validate bounty
	let bounty = null;
	if (bountyId) {
		bounty = await db.models.Bounty.findByPk(bountyId,  { include: db.models.Bounty.Company });
	} else {
		bounty = await db.models.Bounty.findOne({ where: { userId: posterId, companyId: guild.id, slotNumber, state: "open" }, include: db.models.Bounty.Company });
	}
	if (!bounty) {
		throw `You don't have a bounty in slot ${slotNumber}.`;
	}
	if (bounty.userId !== posterId) {
		throw "Only the bounty poster can add completers.";
	}

	// Validate completer IDs
	const validatedCompleterIds = [];
	const existingCompletions = await db.models.Completion.findAll({ where: { bountyId: bounty.id, companyId: guild.id } });
	const existingCompleterIds = existingCompletions.map(completion => completion.userId);
	const bannedIds = [];
	for (const member of completerMembers.filter(member => !existingCompleterIds.includes(member.id))) {
		if (runMode === "prod" && member.user.bot) continue;
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
 * @param {Sequelize} database
 * @returns {[string, string[], { gpContributed: number; goalCompleted: boolean; contributorIds: string[];}]}
 */
async function completeBounty(bounty, poster, validatedHunters, guild, database) {
	bounty.update({ state: "completed", completedAt: new Date() });
	const season = await database.models.Season.findOne({ where: { companyId: bounty.companyId, isCurrentSeason: true } });
	season.increment("bountiesCompleted");
	const rewardTexts = [];
	const progressData = await progressGoal(guild.id, "bounties", poster.userId);
	if (progressData.gpContributed > 0) {
		rewardTexts.push(`This bounty contributed ${progressData.gpContributed} GP to the Server Goal!`);
	}

	const bountyBaseValue = Bounty.calculateCompleterReward(poster.level, bounty.slotNumber, bounty.showcaseCount);
	const company = await database.models.Company.findByPk(bounty.companyId);
	const bountyValue = bountyBaseValue * company.festivalMultiplier;
	database.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });
	for (const hunter of validatedHunters) {
		const completerLevelTexts = await hunter.addXP(guild.name, bountyValue, true, database);
		if (completerLevelTexts.length > 0) {
			rewardTexts.push(...completerLevelTexts);
		}
		hunter.increment("othersFinished");
		const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: bounty.companyId, userId: hunter.userId, seasonId: season.id }, defaults: { xp: bountyValue } });
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
			const [itemRow, itemWasCreated] = await database.models.Item.findOrCreate({ where: { userId: hunter.userId, itemName: droppedItem } });
			if (!itemWasCreated) {
				itemRow.increment("count");
			}
			rewardTexts.push(`<@${hunter.userId}> has found a **${droppedItem}**!`);
		}
	}

	const posterXP = bounty.calculatePosterReward(validatedHunters.length);
	const posterLevelTexts = await poster.addXP(guild.name, posterXP * company.festivalMultiplier, true, database);
	if (posterLevelTexts.length > 0) {
		rewardTexts.push(...posterLevelTexts);
	}
	poster.increment("mineFinished");
	const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: bounty.companyId, userId: bounty.userId, seasonId: season.id }, defaults: { xp: posterXP * company.festivalMultiplier, postingsCompleted: 1 } });
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
		const [itemRow, itemWasCreated] = await database.models.Item.findOrCreate({ where: { userId: bounty.userId, itemName: droppedItem } });
		if (!itemWasCreated) {
			itemRow.increment("count");
		}
		rewardTexts.push(`<@${poster.userId}> has found a **${droppedItem}**!`);
	}
	const multiplierString = bounty.Company.festivalMultiplierString();

	return [
		`__**XP Gained**__\n${validatedHunters.map(hunter => `${userMention(hunter.userId)} + ${bountyBaseValue} XP${multiplierString}`).join("\n")}\n${userMention(poster.userId)} + ${posterXP} XP${multiplierString}`,
		rewardTexts,
		progressData
	];
}

module.exports = {
	setDB,
	addCompleters,
	completeBounty
}
