import { Snowflake } from "discord.js";
import { Op } from "sequelize";
import { Database, DatabaseTypes } from "../database";

let db: Database;

/** *Sets the database pointer for the Goal logic file* */
export function setDB(database: Database) {
	db = database;
}

/** *Finds the most recent ongoing Goal for the specified Company* */
export function findCurrentServerGoal(companyId: Snowflake) {
	return db.Goals.findOne({ where: { companyId, state: "ongoing" }, order: [["createdAt", "DESC"]] });
}

/** *Create a Goal for the specified Company* */
export function createGoal(companyId: Snowflake, type: "bounties" | "toasts" | "secondings", requiredGP: number) {
	return db.Goals.create({ companyId, type, requiredGP });
}

/** *Create a Contribution for the specified contributor on the specified Goal*
 *
 * negative gpContributed values allowed
 */
function createGoalContribution(goalId: string, contributorId: Snowflake, gpContributed: number) {
	return db.Contributions.create({ goalId, userId: contributorId, value: gpContributed });
}

/** *Queries for a Company's most recent Goal and the GP contributed to it* */
export async function findLatestGoalProgress(companyId: Snowflake) {
	const goal = await db.Goals.findOne({ where: { companyId }, order: [["createdAt", "DESC"]] });
	if (!goal) {
		return { goalId: null, requiredGP: 0, currentGP: 0 };
	}
	const currentGP = await db.Contributions.sum("value", { where: { goalId: goal.id } }) ?? 0;
	return { goalId: goal.id, requiredGP: goal.requiredGP, currentGP };
}

const GOAL_POINT_MAP = {
	"bounties": 10,
	"toasts": 1,
	"secondings": 2
};

//TODONOW create enum for progressType
export async function progressGoal(company: DatabaseTypes.Company, progressType: "bounties" | "toasts" | "secondings", hunter: DatabaseTypes.Hunter, season: DatabaseTypes.Season) {
	const contributorIds = [];
	const companyReceipt = {};
	let gpDisplay = 0, gpEarned = 0, goalCompleted = false, currentGP = 0, requiredGP = 0;
	const goal = await db.Goals.findOne({ where: { companyId: company.id, state: "ongoing" }, order: [["createdAt", "DESC"]] });
	if (goal) {
		requiredGP = goal.requiredGP;
		gpDisplay = GOAL_POINT_MAP[progressType];
		if (goal.type === progressType) {
			gpDisplay *= 2;
		}
		gpEarned = gpDisplay;
		companyReceipt.gp = gpDisplay;
		if (company.gpFestivalMultiplier > 1) {
			gpEarned *= company.gpFestivalMultiplier;
			companyReceipt.gpMultiplier = company.festivalMultiplierString("gp");
		}
		await createGoalContribution(goal.id, hunter.userId, gpEarned);
		hunter.increment("goalContributions");
		const [participation] = await db.Participations.findOrCreate({ where: { companyId: company.id, userId: hunter.userId, seasonId: season.id } });
		participation.increment("goalContributions");
		const contributions = await db.Contributions.findAll({ where: { goalId: goal.id } });
		currentGP = contributions.reduce((totalGP, contribution) => totalGP + contribution.value, 0);
		goalCompleted = goal.requiredGP <= currentGP;
		if (goalCompleted) {
			contributorIds = Array.from(new Set(contributions.map(contribution => contribution.userId)));
			db.models.Hunter.update({ itemFindBoost: true }, { where: { userId: { [Op.in]: contributorIds } } });
			goal.update({ state: "completed" });
		} else {
			contributorIds.push(hunter.userId);
		}
	}
	return {
		companyReceipt,
		goalProgress: {
			gpContributed: gpEarned,
			goalCompleted,
			contributorIds,
			currentGP,
			requiredGP
		}
	};
}

/** *Destroy all Goals and Contributions for the specified Company* */
export async function deleteCompanyGoals(companyId: Snowflake) {
	const goals = await db.Goals.findAll({ where: { companyId } });
	await db.Contributions.destroy({ where: { goalId: { [Op.in]: goals.map(goal => goal.id) } } });
	return db.Goals.destroy({ where: { companyId } });
}
