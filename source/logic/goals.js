const { Sequelize, Op } = require("sequelize");
const { Hunter, Season } = require("../database/models");

/** @type {Sequelize} */
let db;

/** *Sets the database pointer for the Goal logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** *Finds the most recent ongoing Goal for the specified Company*
 * @param {string} companyId
 */
function findCurrentServerGoal(companyId) {
	return db.models.Goal.findOne({ where: { companyId, state: "ongoing" }, order: [["createdAt", "DESC"]] });
}

/** *Create a Goal for the specified Company*
 * @param {string} companyId
 * @param {"bounties" | "toasts" | "secondings"} type
 * @param {number} requiredGP
 */
function createGoal(companyId, type, requiredGP) {
	return db.models.Goal.create({ companyId, type, requiredGP });
}

/** *Create a Contribution for the specified contributor on the specified Goal*
 * @param {string} goalId
 * @param {string} contributorId
 * @param {number} gpContributed negative values allowed
 */
function createGoalContribution(goalId, contributorId, gpContributed) {
	return db.models.Contribution.create({ goalId, userId: contributorId, value: gpContributed });
}

/** *Queries for a Company's most recent Goal and the GP contributed to it*
 * @param {string} companyId
 */
async function findLatestGoalProgress(companyId) {
	const goal = await db.models.Goal.findOne({ where: { companyId }, order: [["createdAt", "DESC"]] });
	if (!goal) {
		return { goalId: null, requiredGP: 0, currentGP: 0 };
	}
	const currentGP = await db.models.Contribution.sum("value", { where: { goalId: goal.id } }) ?? 0;
	return { goalId: goal.id, requiredGP: goal.requiredGP, currentGP };
}

const GOAL_POINT_MAP = {
	"bounties": 10,
	"toasts": 1,
	"secondings": 2
};

/**
 * @param {string} companyId
 * @param {"bounties" | "toasts" | "secondings"} progressType
 * @param {Hunter} hunter
 * @param {Season} season
 */
async function progressGoal(companyId, progressType, hunter, season) {
	const returnData = {
		gpContributed: 0,
		goalCompleted: false,
		contributorIds: []
	};
	const goal = await db.models.Goal.findOne({ where: { companyId, state: "ongoing" }, order: [["createdAt", "DESC"]] });
	if (goal) {
		returnData.gpContributed = GOAL_POINT_MAP[progressType];
		if (goal.type === progressType) {
			returnData.gpContributed *= 2;
		}
		await createGoalContribution(goal.id, hunter.userId, returnData.gpContributed);
		hunter.increment("goalContributions");
		const [participation] = await db.models.Participation.findOrCreate({ where: { companyId, userId: hunter.userId, seasonId: season.id } });
		participation.increment("goalContributions");
		const contributions = await db.models.Contribution.findAll({ where: { goalId: goal.id } });
		returnData.goalCompleted = goal.requiredGP <= contributions.reduce((totalGP, contribution) => totalGP + contribution.value, 0);
		if (returnData.goalCompleted) {
			returnData.contributorIds = [...new Set(contributions.map(contribution => contribution.userId))];
			db.models.Hunter.update({ itemFindBoost: true }, { where: { userId: { [Op.in]: returnData.contributorIds } } });
			goal.update({ state: "completed" });
		} else {
			returnData.contributorIds.push(hunter.userId);
		}
	}
	return returnData;
}

/** *Destroy all Goals and Contributions for the specified Company*
 * @param {string} companyId
 */
async function deleteCompanyGoals(companyId) {
	const goals = await db.models.Goal.findAll({ where: { companyId } });
	await db.models.Contribution.destroy({ where: { goalId: { [Op.in]: goals.map(goal => goal.id) } } });
	return db.models.Goal.destroy({ where: { companyId } });
}

module.exports = {
	setDB,
	findCurrentServerGoal,
	createGoal,
	createGoalContribution,
	findLatestGoalProgress,
	progressGoal,
	deleteCompanyGoals
};
