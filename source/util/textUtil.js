const { AutoModerationActionType, GuildMember, TextChannel } = require("discord.js");
const { commandIds } = require("../constants");

/** generates a command mention, which users can click to shortcut them to using the command
 * @param {string} fullCommand for subcommands append a whitespace and the subcommandName
 */
function commandMention(fullCommand) {
	const [mainCommand] = fullCommand.split(" ");
	if (!(mainCommand in commandIds)) {
		return `\`/${fullCommand}\``;
	}

	return `</${fullCommand}:${commandIds[mainCommand]}>`;
}

const CONGRATULATORY_PHRASES = [
	"Congratulations",
	"Well done",
	"You've done it",
	"Nice",
	"Awesome"
];

/** Return a random congragulatory phrase
 * @returns {string}
 */
function congratulationBuilder() {
	return CONGRATULATORY_PHRASES[Math.floor(CONGRATULATORY_PHRASES.length * Math.random())];
}

/** Create a text-only ratio bar that fills left to right
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} barLength
 */
function generateTextBar(numerator, denominator, barLength) {
	const filledBlocks = Math.floor(barLength * numerator / denominator);
	let bar = "";
	for (let i = 0; i < barLength; i++) {
		if (filledBlocks > i) {
			bar += "▰";
		} else {
			bar += "▱";
		}
	}
	return bar;
}

const NUMBER_EMOJI = {
	0: '0️⃣',
	1: '1️⃣',
	2: '2️⃣',
	3: '3️⃣',
	4: '4️⃣',
	5: '5️⃣',
	6: '6️⃣',
	7: '7️⃣',
	8: '8️⃣',
	9: '9️⃣',
	10: '🔟'
};
/**
 * @param {number} number
 * @returns {string}
 */
function getNumberEmoji(number) {
	if (number in NUMBER_EMOJI) {
		return NUMBER_EMOJI[number];
	} else {
		return '#️⃣';
	}
}

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

/** Simulate auto mod actions for texts input to BountyBot
 * @param {TextChannel} channel
 * @param {GuildMember} member
 * @param {string[]} texts
 * @param {string} context
 * @returns whether or not any of the texts included something the auto mod blocks as a message
 */
async function textsHaveAutoModInfraction(channel, member, texts, context) {
	const autoModRules = await channel.guild.autoModerationRules.fetch();
	let shouldBlockMessage = false;
	for (const rule of autoModRules.values()) {
		if (rule.exemptChannels.has(channel.id)) {
			continue;
		}
		if (rule.exemptRoles.hasAny(member.roles.cache.keys())) {
			continue;
		}

		const hasRegexTrigger = texts.some(text => rule.triggerMetadata.regexPatterns.some(regex => new RegExp(regex).test(text)));
		const hasKeywordFilter = texts.some(text => rule.triggerMetadata.keywordFilter.some(regex => new RegExp(regex).test(text)));
		const hasAllowListFilter = texts.some(text => rule.triggerMetadata.allowList.some(regex => new RegExp(regex).test(text)))
		//TODO #94 fetch Discord presets from enum
		const exceedsMentionLimit = texts.some(text => {
			text.match(/<@[\d&]+>/)?.length > rule.triggerMetadata.mentionTotalLimit
		});
		if (((hasRegexTrigger || hasKeywordFilter) && !hasAllowListFilter) || exceedsMentionLimit) {
			for (const action of rule.actions) {
				switch (action.type) {
					case AutoModerationActionType.SendAlertMessage:
						if (action.metadata.channelId) {
							const alertChannel = await channel.guild.channels.fetch(action.metadata.channelId);
							alertChannel.send(`${member} tripped AutoMod in a ${context} with text(s): ${texts.join(", ")}`);
						}
						break;
					case AutoModerationActionType.Timeout:
						member.timeout(action.metadata.durationSeconds * 1000, `AutoMod timeout in a ${context} with texts: ${texts.join(", ")}`).catch(error => {
							if (error.code != 50013) { // 50013 is Missing Permissions
								console.error(error);
							}
						});
						break;
					case AutoModerationActionType.BlockMessage:
						member.send(action.metadata.customMessage || `Your ${context} could not be completed because it tripped AutoMod.`);
						shouldBlockMessage = true;
						break;
				}
			}
		}
	}
	return shouldBlockMessage;
}

/** Formats string array into Oxford English list syntax
 *  @param {string[]} texts
 *  @param {boolean} isMutuallyExclusive
 */
function listifyEN(texts, isMutuallyExclusive) {
	if (texts.length > 2) {
		const textsSansLast = texts.slice(0, texts.length - 1);
		if (isMutuallyExclusive) {
			return `${textsSansLast.join(", ")}, or ${texts[texts.length - 1]}`;
		} else {
			return `${textsSansLast.join(", ")}, and ${texts[texts.length - 1]}`;
		}
	} else if (texts.length === 2) {
		if (isMutuallyExclusive) {
			return texts.join(" or ");
		} else {
			return texts.join(" and ");
		}
	} else if (texts.length === 1) {
		return texts[0];
	} else {
		return "";
	}
}

/** @param {string} text */
function trimForSelectOptionDescription(text) {
	if (text.length > 100) {
		return `${text.slice(0, 99)}…`;
	} else {
		return text;
	}
}

/** @param {string} text */
function trimForModalTitle(text) {
	if (text.length > 45) {
		return `${text.slice(0, 44)}…`;
	} else {
		return text;
	}
}

module.exports = {
	commandMention,
	congratulationBuilder,
	generateTextBar,
	getNumberEmoji,
	timeConversion,
	dateInPast,
	dateInFuture,
	textsHaveAutoModInfraction,
	listifyEN,
	trimForSelectOptionDescription,
	trimForModalTitle
};
