const { Sequelize, Op } = require("sequelize");

/**
 * @param {string} companyId
 * @param {"bounties" | "toasts" | "secondings"} progressType
 * @param {string} userId
 * @param {Sequelize} database
 */
async function progressGoal(companyId, progressType, userId, database) {
	const returnData = {
		gpContributed: 0,
		goalCompleted: false,
		contributorIds: []
	};
	const goal = await database.models.Goal.findOne({ where: { companyId, state: "ongoing" } });
	const goalProgressed = goal?.type === progressType;
	if (goalProgressed) {
		returnData.gpContributed = 1;
		await database.models.Contribution.create({ goalId: goal.id, userId });
		const [hunter] = await database.models.Hunter.findOrCreate({ where: { companyId, userId } });
		hunter.increment("goalContributions");
		const [season] = await database.models.Season.findOrCreate({ where: { companyId, isCurrentSeason: true } });
		const [participation] = await database.models.Participation.findOrCreate({ where: { companyId, userId, seasonId: season.id } });
		participation.increment("goalContributions");
		const contributions = await database.models.Contribution.findAll({ where: { goalId: goal.id } });
		returnData.goalCompleted = goal.requiredContributions <= contributions.length;
		if (returnData.goalCompleted) {
			returnData.contributorIds = [...new Set(contributions.map(contribution => contribution.userId))];
			database.models.Hunter.update({ itemFindBoost: true }, { where: { userId: { [Op.in]: returnData.contributorIds } } });
			goal.update({ state: "completed" });
		} else {
			returnData.contributorIds.push(userId);
		}
	}
	return returnData;
}

module.exports = {
	progressGoal
};
