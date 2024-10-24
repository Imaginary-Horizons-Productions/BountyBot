const { Sequelize } = require("sequelize");
const { userMention, Guild } = require("discord.js");
const { Bounty } = require("../models/bounties/Bounty");
const { Company } = require("../models/companies/Company");
const { Hunter } = require("../models/users/Hunter");
const { listifyEN, congratulationBuilder } = require("../util/textUtil");
const { updateScoreboard } = require("../util/embedUtil");
const { progressGoal } = require("./goals");

/**
 * @param {Guild} guild
 * @param {Sequelize} database
 * @param {Bounty} bounty
 * @param {Company} company
 * @param {string[]} completerIds
 */
function addCompleters(guild, database, bounty, company, completerIds) {
	const rawCompletions = [];
	for (const userId of completerIds) {
		rawCompletions.push({
			bountyId: bounty.id,
			userId,
			companyId: guild.id
		})
	}
	database.models.Completion.bulkCreate(rawCompletions);
	bounty.updatePosting(guild, company, database);
	if (company.bountyBoardId) {
		guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
			return bountyBoard.threads.fetch(bounty.postingId);
		}).then(posting => {
			posting.send({ content: `${listifyEN(completerIds.map(id => userMention(id)))} ${completerIds.length === 1 ? "has" : "have"} been added as ${completerIds.length === 1 ? "a completer" : "completers"} of this bounty! ${congratulationBuilder()}!` });
		});
	}
}

/**
 * @param {Bounty} bounty
 * @param {Hunter} poster
 * @param {Hunter[]} validatedHunters
 * @param {Guild} guild
 * @param {Sequelize} database
 */
async function completeBounty(bounty, poster, validatedHunters, guild, database) {
	bounty.update({ state: "completed", completedAt: new Date() });
	const season = await database.models.Season.findOne({ where: { companyId: bounty.companyId, isCurrentSeason: true } });
	season.increment("bountiesCompleted");
	const progressString = await progressGoal(bounty.companyId, "bounties", bounty.userId, database);
	const rewardTexts = [];
	if (progressString) {
		rewardTexts.push(progressString);
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
	return rewardTexts;
}

module.exports = {
	addCompleters,
	completeBounty
}
