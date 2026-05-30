import type { TimestampStylesString } from "discord.js";
import { MemberOf } from "./types";

export const TimeUnitKind = {
	Week: "w",
	Day: "d",
	Hour: "h",
	Minute: "m",
	Second: "s",
	Milisecond: "ms"
} as const;

export type TimeUnitKind = MemberOf<typeof TimeUnitKind>;

export function isTimeUnitKind(text: string): text is TimeUnitKind {
	return Object.values(TimeUnitKind).some(unit => unit === text);
}

/** Convert an amount of time from a starting unit to a different one */
export function timeConversion(value: number, startingUnit: TimeUnitKind, resultUnit: TimeUnitKind) {
	const unknownUnits = [];
	let msPerStartUnit = 1;
	switch (startingUnit.toLowerCase()) {
		case "w":
			msPerStartUnit *= 7;
		case "d":
			msPerStartUnit *= 24;
		case "h":
			msPerStartUnit *= 60;
		case "m":
			msPerStartUnit *= 60;
		case "s":
			msPerStartUnit *= 1000;
		case "ms":
			msPerStartUnit *= 1;
			break;
		default:
			unknownUnits.push(startingUnit);
	}

	let msPerResultUnit = 1;
	switch (resultUnit.toLowerCase()) {
		case "w":
			msPerResultUnit *= 7;
		case "d":
			msPerResultUnit *= 24;
		case "h":
			msPerResultUnit *= 60;
		case "m":
			msPerResultUnit *= 60;
		case "s":
			msPerResultUnit *= 1000;
		case "ms":
			msPerResultUnit *= 1;
			break;
		default:
			unknownUnits.push(resultUnit);
	}
	if (!unknownUnits.length) {
		return value * msPerStartUnit / msPerResultUnit;
	} else {
		throw new Error(`Unknown unit used: ${unknownUnits.join(", ")} (allowed units: ms, s, m, h, d, w)`)
	}
}

type HeterogeneousDuration = Partial<Record<TimeUnitKind, number>>;

/**
 * A utility wrapper for @function timeConversion that goes back in time from the current timestamp
 * @param timeMap The amount of time to go back in the past
 */
export function dateInPast(timeMap: HeterogeneousDuration) {
	let nowMs = Date.now();
	for (const key in timeMap) {
		if (isTimeUnitKind(key) && timeMap[key]) {
			nowMs -= timeConversion(timeMap[key], key, TimeUnitKind.Milisecond);
		}
	}
	return new Date(nowMs);
}

/**
 * A utility wrapper for @function timeConversion that goes into the future from the current timestamp
 * @param timeMap The amount of time to go into the future
*/
export function dateInFuture(timeMap: HeterogeneousDuration) {
	let nowMS = Date.now();
	for (const key in timeMap) {
		if (isTimeUnitKind(key) && timeMap[key]) {
			nowMS += timeConversion(timeMap[key], key, TimeUnitKind.Milisecond);
		}
	}
	return new Date(nowMS);
}

export function ascendingByProperty(property: string) {
	return (a: { [property]: number }, b: { [property]: number }) => a[property] - b[property];
}

export function descendingByProperty(property: string) {
	return (a: { [property]: number }, b: { [property]: number }) => b[property] - a[property];
}

/** Formats a Unix Epoch into a string that Discord parses into the viewer's timezone, including style options
 * @param secondsSinceStartOf1970 aka the Unix Epoch, must be an integer to parse
 * @param style using Discord.js's `TimestampStyles` recommended, see that object's properties for examples
 */
export function discordTimestamp(secondsSinceStartOf1970: number, style?: TimestampStylesString) {
	if (style) {
		return `<t:${secondsSinceStartOf1970}:${style}>`;
	} else {
		return `<t:${secondsSinceStartOf1970}>`;
	}
}
