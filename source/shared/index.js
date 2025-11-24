const { TimestampStyles } = require("discord.js");

/** Convert an amount of time from a starting unit to a different one
 * @param {number} value
 * @param {"w" | "d" | "h" | "m" | "s" | "ms"} startingUnit
 * @param {"w" | "d" | "h" | "m" | "s" | "ms"} resultUnit
 */
function timeConversion(value, startingUnit, resultUnit) {
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

/**
 * A utility wrapper for @function timeConversion that goes back in time from the current timestamp
 * @param {{w?: number,
 * 			d?: number,
 * 			h?: number,
 * 			m?: number,
 * 			s?: number,
 * 			ms?: number}} timeMap The amount of time to go back in the past
 */
function dateInPast(timeMap) {
	let nowTimestamp = new Date();
	for (const key in timeMap) {
		nowTimestamp -= timeConversion(timeMap[key], key, 'ms');
	}
	return new Date(nowTimestamp);
}

/**
 * A utility wrapper for @function timeConversion that goes into the future from the current timestamp
 * @param {{w?: number,
* 			d?: number,
* 			h?: number,
* 			m?: number,
* 			s?: number,
* 			ms?: number}} timeMap The amount of time to go into the future
*/
function dateInFuture(timeMap) {
	let nowTimestamp = new Date();
	for (const key in timeMap) {
		nowTimestamp += timeConversion(timeMap[key], key, 'ms');
	}
	return new Date(nowTimestamp);
}

/** @param {string} property */
function ascendingByProperty(property) {
	return (a, b) => a[property] - b[property];
}

/** @param {string} property */
function descendingByProperty(property) {
	return (a, b) => b[property] - a[property];
}

/** Formats a Unix Epoch into a string that Discord parses into the viewer's timezone, including style options
 * @param {number} secondsSinceStartOf1970 aka the Unix Epoch, must be an integer to parse
 * @param {TimestampStyles[keyof TimestampStyles]?} style using Discord.js's `TimestampStyles` recommended, see that object's properties for examples
 */
function discordTimestamp(secondsSinceStartOf1970, style) {
	if (style) {
		return `<t:${secondsSinceStartOf1970}:${style}>`;
	} else {
		return `<t:${secondsSinceStartOf1970}>`;
	}
}

module.exports = {
	timeConversion,
	dateInPast,
	dateInFuture,
	ascendingByProperty,
	descendingByProperty,
	discordTimestamp
};
