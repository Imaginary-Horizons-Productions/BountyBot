const { userMention } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { listifyEN } = require("../util/textUtil");

/**
 * @param {string} companyId
 * @param {"bounties" | "toasts" | "secondings"} progressType
 * @param {string} userId
 * @param {Sequelize} database
 */
async function progressGoal(companyId, progressType, userId, database) {
	const goal = await database.models.Goal.findOne({ where: { companyId, state: "ongoing" } });
	const goalProgressed = goal?.type === progressType;
	if (goalProgressed) {
		await database.models.Contributions.create({ goalId: goal.id, userId });
		await database.models.Hunter.update("goalContributions", { where: { companyId, userId } });
		const [season] = await database.models.Season.findOrCreate({ where: { companyId, isCurrentSeason: true } });
		await database.models.Participation.upsert("goalContributions", { where: { companyId, userId, seasonId: season.id } });
		const contributions = await database.models.Contributions.findAll({ where: { goalId: goal.id } });
		if (goal.requiredContributions <= contributions.length) {
			const dedupedContributorIds = [...new Set(contributions.map(contribution => contribution.userId))];
			database.models.Hunter.update({ itemFindBoost: true }, { where: { userId: { [Op.in]: dedupedContributorIds } } });
			goal.update("state", "completed");
			return `The Server Goal was completed! ${listifyEN(dedupedContributorIds.map(id => userMention(id)))} gained an Item Find Boost for their next bounty completion!`
		}
		return `${userMention(userId)} contributed to the Server Goal!`;
	}
	return "";
}

module.exports = {
	progressGoal
};
