import { DatabaseTypes } from "../../database";

export function calculateXPMean(participations: Map<any, DatabaseTypes.Participation>) {
	if (participations.size < 1) {
		return null;
	}
	let totalXP = 0;
	for (const particpation of participations.values()) {
		totalXP += particpation.xp;
	}
	return totalXP / participations.size;
}

export function calculateXPStandardDeviation(participations: Map<any, DatabaseTypes.Participation>, mean: number) {
	if (participations.size < 1) {
		return null;
	}
	let squareSum = 0;
	for (const participation of participations.values()) {
		squareSum += (participation.xp - mean) ** 2;
	}
	return Math.sqrt(squareSum / participations.size);
}
