const { heading, userMention, unorderedList, bold, italic } = require("discord.js");
const { commandIds } = require("../../constants");
const { MessageLimits } = require("@sapphire/discord.js-utilities");
const { Hunter } = require("../../database/models");

/**
 * @file String Constructors - formatted reusable strings
 *
 * Naming Convention:
 * - nouns
 */

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

function randomCongratulatoryPhrase() {
	return CONGRATULATORY_PHRASES[Math.floor(CONGRATULATORY_PHRASES.length * Math.random())];
}

/** Create a text-only ratio bar that fills left to right
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} barLength
 */
function fillableTextBar(numerator, denominator, barLength) {
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

const NUMBER_EMOJI = { 0: '0️⃣', 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣', 6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣', 10: '🔟' };
/**
 * @param {number} number
 * @returns {string}
 */
function emojiFromNumber(number) {
	if (number in NUMBER_EMOJI) {
		return NUMBER_EMOJI[number];
	} else {
		return '#️⃣';
	}
}

/** Formats string array into Oxford English list syntax
 *  @param {string[]} texts
 *  @param {boolean} isMutuallyExclusive
 */
function sentenceListEN(texts, isMutuallyExclusive) {
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

/**
 * @param {Company} company
 * @param {number} previousLevel
 * @param {Map<string, Hunter>} hunterMap
 * @param {string} guildName
 */
function companyLevelUpLine(company, previousLevel, hunterMap, guildName) {
	const currentLevel = Company.getLevel(company.getXP(hunterMap));
	if (currentLevel > previousLevel) {
		return `${guildName} is now level ${currentLevel}! Evergreen bounties now award more XP!`;
	}
	return null;
}

/**
 * @param {Hunter} hunter
 * @param {number} previousLevel
 * @param {number} xpCoefficient
 * @param {number} maxSimBounties
 */
function hunterLevelUpLine(hunter, previousLevel, xpCoefficient, maxSimBounties) {
	const currentLevel = hunter.getLevel(xpCoefficient);
	if (currentLevel > previousLevel) {
		const rewards = [];
		for (let level = previousLevel + 1; level <= currentLevel; level++) {
			rewards.push(...hunterLevelUpRewards(level, maxSimBounties, false));
		}
		return `${randomCongratulatoryPhrase()}, ${userMention(hunter.userId)}! You have leveled up to level ${bold(currentLevel)}!\n\t- ${rewards.join('\n\t- ')}`;
	}
	return null;
}

/**
 * @param {number} level
 * @param {number} maxSlots
 * @param {boolean} futureReward
 */
function hunterLevelUpRewards(level, maxSlots, futureReward = true) {
	const texts = [];
	if (level % 2) {
		texts.push(`Your bounties in odd-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`);
	} else {
		texts.push(`Your bounties in even-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`);
	}
	const currentSlots = Hunter.getBountySlotCount(level, maxSlots);
	if (currentSlots < maxSlots) {
		if (level == 3 + 12 * Math.floor((currentSlots - 2) / 2) + 7 * ((currentSlots - 2) % 2)) {
			texts.push(` You ${futureReward ? "will unlock" : "have unlocked"} bounty slot #${currentSlots}.`);
		};
	}
	return texts;
}

/**
 * @param {MapIterator<string>} completerIds
 * @param {number} completerReward
 * @param {string?} posterId null for evergreen bounties
 * @param {number?} posterReward null for evergreen bounties
 * @param {string} multiplierString
 * @param {string[]} rankUpdates
 * @param {string[]} rewardTexts
 */
function rewardStringBountyCompletion(completerIds, completerReward, posterId, posterReward, multiplierString, rankUpdates, rewardTexts) {
	let text = `${heading("XP Gained", 2)}\n${Array.from(completerIds.map(id => `${userMention(id)} +${completerReward} XP${multiplierString}`)).join("\n")}`;
	if (posterId && posterReward) {
		text += `\n${userMention(posterId)} +${posterReward} XP${multiplierString}`;
	}
	if (rankUpdates.length > 0) {
		text += `\n${heading("Rank Ups", 2)}\n${unorderedList(rankUpdates)}`;
	}
	if (rewardTexts.length > 0) {
		text += `\n${heading("Rewards", 2)}\n${unorderedList(rewardTexts)}`;
	}
	if (text.length > MessageLimits.MaximumLength) {
		return `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
	}
	return text;
}

/**
 * @param {string[]} rewardedHunterIds
 * @param {string[]} rankUpdates
 * @param {string[]} rewardTexts
 * @param {string} senderMention
 * @param {string} multiplierString
 * @param {number} critValue
 */
function rewardStringToast(rewardedHunterIds, rankUpdates, rewardTexts, senderMention, multiplierString, critValue) {
	let rewardString = `${heading("XP Gained", 2)}\n${rewardedHunterIds.map(id => `${userMention(id)} +1 XP${multiplierString}`).join("\n")}`;
	if (critValue > 0) {
		rewardString += `\n${senderMention} + ${critValue} XP${multiplierString} ${italic("Critical Toast!")}`;
	}
	if (rankUpdates.length > 0) {
		rewardString += `\n${heading("Rank Ups", 2)}\n${unorderedList(rankUpdates)}`;
	}
	if (rewardTexts.length > 0) {
		rewardString += `\n${heading("Rewards", 2)}\n${unorderedList(rewardTexts)}`;
	}
	if (rewardString.length > MessageLimits.MaximumLength) {
		return `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
	}
	return rewardString;
}

/**
 * @param {string} seconderDisplayName
 * @param {string[]} recipientIds
 * @param {string[]} rankUpdates
 * @param {string[]} rewardTexts
 */
function rewardStringSeconding(seconderDisplayName, recipientIds, rankUpdates, rewardTexts) {
	let text = `${seconderDisplayName} seconded this toast!`;
	if (recipientIds.length > 0) {
		text += `\n${heading("XP Gained", 2)}`;
	}
	for (const id of recipientIds) {
		text += `\n${userMention(id)} +1 XP`;
		if (id === seconderDisplayName) {
			text += ` ${italic("Critical Toast!")}`;
		}
	}
	if (rankUpdates.length > 0) {
		text += `\n${heading("Rank Ups", 2)}\n${unorderedList(rankUpdates)}`;
	}
	if (rewardTexts.length > 0) {
		text += `\n${heading("Rewards", 2)}\n${unorderedList(rewardTexts)}`;
	}
	if (text.length > MessageLimits.MaximumLength) {
		return `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
	}
	return text;
}

module.exports = {
	commandMention,
	randomCongratulatoryPhrase,
	fillableTextBar,
	emojiFromNumber,
	sentenceListEN,
	companyLevelUpLine,
	hunterLevelUpLine,
	hunterLevelUpRewards,
	rewardStringBountyCompletion,
	rewardStringToast,
	rewardStringSeconding
}
