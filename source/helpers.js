const { Op } = require("sequelize");
const { database } = require("../database");
const { Guild } = require("discord.js");
const { Hunter } = require("./models/users/Hunter");
const { GuildRank } = require("./models/guilds/GuildRank");

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
exports.getNumberEmoji = function (number) {
	if (number in NUMBER_EMOJI) {
		return NUMBER_EMOJI[number];
	} else {
		return '#️⃣';
	}
}

/** Recalculates the ranks (standard deviations from mean) and placements (ordinal) for the given participants
 * @param {Hunter[]} participants
 * @param {GuildRank[]} ranks
 * @returns Promise of the message congratulating the hunter reaching first place (or `null` if no change)
 */
exports.setRanks = async (participants, ranks) => {
	let previousFirstPlaceId;
	let mean = 0;
	const rankableHunters = [];
	for (const hunter of participants) {
		if (hunter.isRankEligible) {
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
	for (const hunter of rankableHunters) {
		let variance = (hunter.seasonXP - mean) / stdDev;
		ranks.forEach((rank, index) => {
			if (variance >= rank.varianceThreshold) {
				hunter.rank = index;
			}
		});
		hunter.nextRankXP = Math.ceil(stdDev * ranks[hunter.rank].varianceThreshold + mean - hunter.seasonXP);
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
	const allHunters = await database.models.Hunter.findAll({ where: { guildId: guild.id }, order: [["seasonXP", "DESC"]] });
	const ranks = await database.models.GuildRank.findAll({ where: { guildId: guild.id }, order: [["varianceThreshold", "ASC"]] });
	return exports.setRanks(allHunters, ranks).then(async (firstPlaceMessage) => {
		const roleIds = ranks.filter(rank => rank.roleId != "").map(rank => rank.roleId);
		const outMessages = [];
		if (firstPlaceMessage) {
			outMessages.push(firstPlaceMessage);
		}
		for (const hunter of allHunters) {
			if (force || hunter.rank != hunter.lastRank) {
				const member = await guild.members.fetch(hunter.userId);
				let destinationRole;
				if (member.manageable) {
					await member.roles.remove(roleIds);
					if (hunter.isRankEligible) { // Feature: remove rank roles from DQ'd users but don't give them new ones
						const rankRoleId = ranks[hunter.rank]?.roleId;
						if (rankRoleId) {
							await member.roles.add(rankRoleId);
							destinationRole = await guild.roles.fetch(rankRoleId);
						}
					}
				}
				if (hunter.rank > hunter.lastRank) { // Feature: don't comment on rank downs
					outMessages.push(`${exports.congratulationBuilder()}, ${member.toString()}! You've risen to ${destinationRole ? destinationRole.name : `Rank ${hunter.rank + 1}`}!`);
				}
			}
		}
		return outMessages;
	});
}
