const { Participation } = require("../../database/models");

/** @param {Map<any, Participation>} participations */
function calculateXPMean(participations) {
	if (participations.size < 1) {
		return null;
	}
	let totalXP = 0;
	for (const [_, particpation] of participations) {
		totalXP += particpation.xp;
	}
	return totalXP / participations.size;
}

/**
 * @param {Map<any, Participation>} participations
 * @param {number} mean
 */
function calculateXPStandardDeviation(participations, mean) {
	if (participations.size < 1) {
		return null;
	}
	let squareSum = 0;
	for (const [_, participation] of participations) {
		squareSum += (participation.xp - mean) ** 2;
	}
	return Math.sqrt(squareSum / participations.size);
}

module.exports = {
	calculateXPMean,
	calculateXPStandardDeviation
};
