const { Sequelize, Op } = require("sequelize");

/** @type {Sequelize} */
let db;

/** *Sets the database pointer for the Goal logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** *Queries for a Company's most recent Goal and the GP contributed to it*
 * @param {string} companyId
 */
async function findLatestGoalProgress(companyId) {
	const goal = await db.models.Goal.findOne({ where: { companyId }, order: [["createdAt", "DESC"]] });
	const currentGP = await db.models.Contribution.sum("value", { where: { goalId: goal.id } }) ?? 0;
	return { requiredGP: goal?.requiredContributions ?? 0, currentGP };
}

const GOAL_POINT_MAP = {
	"bounties": 10,
	"toasts": 1,
	"secondings": 2
};

/**
 * @param {string} companyId
 * @param {"bounties" | "toasts" | "secondings"} progressType
 * @param {string} userId
 */
async function progressGoal(companyId, progressType, userId) {
	const returnData = {
		gpContributed: 0,
		goalCompleted: false,
		contributorIds: []
	};
	const goal = await db.models.Goal.findOne({ where: { companyId, state: "ongoing" } });
	if (goal) {
		returnData.gpContributed = GOAL_POINT_MAP[progressType];
		if (goal.type === progressType) {
			returnData.gpContributed *= 2;
		}
		await db.models.User.findOrCreate({ where: { id: userId } });
		await db.models.Contribution.create({ goalId: goal.id, userId, value: returnData.gpContributed });
		const [hunter] = await db.models.Hunter.findOrCreate({ where: { companyId, userId } });
		hunter.increment("goalContributions");
		const [season] = await db.models.Season.findOrCreate({ where: { companyId, isCurrentSeason: true } });
		const [participation] = await db.models.Participation.findOrCreate({ where: { companyId, userId, seasonId: season.id } });
		participation.increment("goalContributions");
		const contributions = await db.models.Contribution.findAll({ where: { goalId: goal.id } });
		returnData.goalCompleted = goal.requiredContributions <= contributions.reduce((totalGP, contribution) => totalGP + contribution.value, 0);
		if (returnData.goalCompleted) {
			returnData.contributorIds = [...new Set(contributions.map(contribution => contribution.userId))];
			db.models.Hunter.update({ itemFindBoost: true }, { where: { userId: { [Op.in]: returnData.contributorIds } } });
			goal.update({ state: "completed" });
		} else {
			returnData.contributorIds.push(userId);
		}
	}
	return returnData;
}

module.exports = {
	setDB,
	findLatestGoalProgress,
	progressGoal
};
