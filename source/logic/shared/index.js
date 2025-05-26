const { Participation } = require("../../database/models");

/** @param {string} property */
function ascendingByProperty(property) {
	return (a, b) => a[property] - b[property];
}

/** @param {string} property */
function descendingByProperty(property) {
	return (a, b) => b[property] - a[property];
}

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
	ascendingByProperty,
	descendingByProperty,
	calculateXPMean,
	calculateXPStandardDeviation
};
