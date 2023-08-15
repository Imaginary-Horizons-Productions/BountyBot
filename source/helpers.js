const { database } = require("../database");
const { Guild, AutoModerationActionType, GuildMember, TextChannel } = require("discord.js");
const { CompanyRank } = require("./models/companies/CompanyRank");

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
exports.congratulationBuilder = function () {
	return CONGRATULATORY_PHRASES[Math.floor(CONGRATULATORY_PHRASES.length * Math.random())];
}

/** Create a text-only ratio bar that fills left to right
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} barLength
 */
exports.generateTextBar = function (numerator, denominator, barLength) {
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
exports.getNumberEmoji = function (number) {
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
exports.timeConversion = function (value, startingUnit, resultUnit) {
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

/** Extracting user ids from mentions in a string allows us to accept an arbitrary number of users from a single string input
 * @param {string} mentionsText
 * @param {string[]} exlcuedIds
 */
exports.extractUserIdsFromMentions = function (mentionsText, exlcuedIds) {
	const idRegExp = RegExp(/<@(\d+)>/, "g");
	const ids = [];
	let results;
	while ((results = idRegExp.exec(mentionsText)) != null) {
		const id = results[1];
		if (!exlcuedIds.includes(id)) {
			ids.push(id);
		}
	}
	return ids;
}

/** Recalculates the ranks (standard deviations from mean) and placements (ordinal) for the given participants
 * @param {database.models.Hunter[]} participants
 * @param {CompanyRank[]} ranks
 * @returns Promise of the message congratulating the hunter reaching first place (or `null` if no change)
 */
exports.setRanks = async (participants, ranks) => {
	let previousFirstPlaceId;
	let mean = 0;
	const rankableHunters = [];
	for (const hunter of participants) {
		if (hunter.isRankEligible && !hunter.isRankDisqualified) {
			if (hunter.seasonPlacement == 1) {
				previousFirstPlaceId = hunter.userId;
			}
			hunter.lastRank = hunter.rank;
			mean += hunter.seasonXP;
			rankableHunters.push(hunter);
		} else {
			hunter.nextRankXP = 0;
		}
	}

	if (rankableHunters.length < 2) {
		for (const hunter of participants) {
			hunter.rank = null;
			hunter.seasonPlacement = 0;
			hunter.save();
		}
		return null;
	}

	mean /= rankableHunters.length;
	const stdDev = Math.sqrt(rankableHunters.reduce((total, hunter) => total + (hunter.seasonXP - mean) ** 2, 0) / rankableHunters.length);
	if (ranks?.length > 0) {
		for (const hunter of rankableHunters) {
			let variance = (hunter.seasonXP - mean) / stdDev; //TODO actually store Hunter.xpVariance and make Hunter.rank a virtual field
			let index = -1;
			for (const rank of ranks) {
				index++;
				if (variance >= rank.varianceThreshold) {
					break;
				}
			}
			hunter.rank = index;
			hunter.nextRankXP = Math.ceil(stdDev * ranks[hunter.rank].varianceThreshold + mean - hunter.seasonXP);
		}
	}
	let recentPlacement = participants.length - 1; // subtract 1 to adjust for array indexes starting from 0
	let previousScore = 0;
	let firstPlaceId;
	for (let i = recentPlacement; i >= 0; i -= 1) {
		let hunter = participants[i];
		if (hunter.seasonXP > previousScore) {
			previousScore = hunter.seasonXP;
			recentPlacement = i + 1;
			hunter.seasonPlacement = recentPlacement;
		} else {
			hunter.seasonPlacement = recentPlacement;
			if (recentPlacement == 1 && hunter.id != previousFirstPlaceId) {
				// Feature: No first place message on first season XP of season (no one to compete with)
				firstPlaceId = hunter.id;
			}
		}
		hunter.save();
	}
	return firstPlaceId ? `*<@${firstPlaceId}> has reached the #1 spot for this season!*` : null;
}

/** Update ranks for all hunters in the guild, then return rank up messages
 * @param {Guild} guild
 * @param {boolean} force
 * @returns an array of rank and placement update strings
 */
exports.getRankUpdates = async function (guild, force = false) {
	const allHunters = await database.models.Hunter.findAll({ where: { companyId: guild.id }, order: [["seasonXP", "DESC"]] });
	const ranks = await database.models.CompanyRank.findAll({ where: { companyId: guild.id }, order: [["varianceThreshold", "DESC"]] });
	return exports.setRanks(allHunters, ranks).then(async (firstPlaceMessage) => {
		const roleIds = ranks.filter(rank => rank.roleId != "").map(rank => rank.roleId);
		const outMessages = [];
		if (firstPlaceMessage) {
			outMessages.push(firstPlaceMessage);
		}
		for (const hunter of allHunters) {
			if (force || hunter.rank != hunter.lastRank) {
				const member = await guild.members.fetch(hunter.userId);
				if (member.manageable) {
					await member.roles.remove(roleIds);
					if (hunter.isRankEligible && !hunter.isRankDisqualified) { // Feature: remove rank roles from DQ'd users but don't give them new ones
						let destinationRole;
						const rankRoleId = ranks[hunter.rank]?.roleId;
						if (rankRoleId) {
							await member.roles.add(rankRoleId);
							destinationRole = await guild.roles.fetch(rankRoleId);
						}
						if (destinationRole && hunter.rank < hunter.lastRank) { // Note: higher ranks are lower value
							outMessages.push(`${exports.congratulationBuilder()}, ${member.toString()}! You've risen to ${destinationRole.name}!`);
						}
					}
				}
			}
		}
		return outMessages;
	});
}

exports.generateBountyBoardThread = function (threadManager, embeds, company) {
	return threadManager.create({
		name: "Evergreen Bounties",
		message: { embeds }
	}).then(thread => {
		company.evergreenThreadId = thread.id;
		company.save();
		thread.pin();
		return thread;
	})
}

/** Simulate auto mod actions for texts input to BountyBot
 * @param {TextChannel} channel
 * @param {GuildMember} member
 * @param {string[]} texts
 * @param {string} context
 * @returns whether or not any of the texts included something the auto mod blocks as a message
 */
exports.checkTextsInAutoMod = async function (channel, member, texts, context) {
	const autoModRules = await channel.guild.autoModerationRules.fetch();
	let shouldBlockMessage = false;
	for (const rule of autoModRules.values()) {
		if (rule.exemptChannels.has(channel.id)) {
			continue;
		}
		if (rule.exemptRoles.hasAny(member.roles.cache.keys())) {
			continue;
		}

		//TODO use rule.triggerMetaData.allowList
		const hasRegexTrigger = texts.some(text => rule.triggerMetadata.regexPatterns.some(regex => new RegExp(regex).test(text)));
		const hasKeywordFilter = texts.some(text => rule.triggerMetadata.keywordFilter.some(regex => new RegExp(regex).test(text)));
		//TODO fetch Discord presets from enum
		const exceedsMentionLimit = texts.some(text => {
			text.match(/<@[\d&]+>/)?.length > rule.triggerMetadata.mentionTotalLimit
		});
		for (const action of rule.actions) {
			if (hasRegexTrigger || hasKeywordFilter || exceedsMentionLimit) {
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
