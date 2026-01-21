const { heading, userMention, bold, italic } = require("discord.js");
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
 * @param {"bounty" | "toast" | "seconding" | "item"} actionType
 * @param {{ guildName: string; levelUp?: number; gp?: number; gpMultiplier?: string; }} companyReceipt
 * @param {Map<string, Partial<{ title: "Critical Toast!" | "Bounty Poster"; rankUp: { name: string; newRankIndex: number; }; topPlacement: boolean; xp: number; xpMultiplier: string; levelUp: { achievedlevel: number; previousLevel: number; }; item: string; }>>} hunterReceipts
 * @param {number} companyMaxBountySlots
 */
function rewardSummary(actionType, companyReceipt, hunterReceipts, companyMaxBountySlots) {
	if (Object.keys(companyReceipt).length + hunterReceipts.size === 0) {
		return "";
	}

	let summary = heading("Rewards", 2);
	if ("levelUp" in companyReceipt) {
		summary += `\n- ${companyReceipt.guildName} is now Level ${companyReceipt.levelUp}! Evergreen bounties now award more XP!`;
	}
	if ("gp" in companyReceipt) {
		summary += `\n- This ${actionType} contributed ${companyReceipt.gp} GP${companyReceipt.gpMultiplier} to the Server Goal!`;
	}

	for (const [id, receipt] of hunterReceipts) {
		summary += `\n### ${userMention(id)}`;
		if ("title" in receipt) {
			summary += ` - ${receipt.title}`
		}
		if ("xp" in receipt) {
			if ("levelUp" in receipt) {
				summary += `\n- Gained ${receipt.xp} XP${receipt.xpMultiplier ?? ""} and reached ${bold(`Level ${receipt.levelUp.achievedlevel}`)}!`;
				for (let level = receipt.levelUp.previousLevel + 1; level <= receipt.levelUp.achievedlevel; level++) {
					let oddSlotBaseRewardIncrease = null;
					let evenSlotBaseRewardIncrease = null;
					const bountySlotsUnlocked = [];
					for (const [type, value] of Hunter.getLevelUpRewards(level, companyMaxBountySlots)) {
						switch (type) {
							case "oddSlotBaseRewardIncrease":
								if (oddSlotBaseRewardIncrease === null || value > oddSlotBaseRewardIncrease) {
									oddSlotBaseRewardIncrease = value;
								}
								break;
							case "evenSlotBaseRewardIncrease":
								if (evenSlotBaseRewardIncrease === null || value > evenSlotBaseRewardIncrease) {
									evenSlotBaseRewardIncrease = value;
								}
								break;
							case "bountySlotUnlocked":
								bountySlotsUnlocked.push(value);
								break;
						}
					}
					if (bountySlotsUnlocked.length > 0) {
						if (bountySlotsUnlocked.length === 1) {
							summary += `\n   - You have unlocked Bounty Slot #${bountySlotsUnlocked[0]}.`;
						} else {
							summary += `\n   - You have unlocked ${sentenceListEN(bountySlotsUnlocked.map(slotNumber => `Bounty Slot #${slotNumber}`))}.`;
						}
					}
					if (oddSlotBaseRewardIncrease) {
						summary += `\n   - The base reward of your odd-numbered bounty slots has increased (max: ${oddSlotBaseRewardIncrease} Reward XP in Slot #1)!`;
					}
					if (evenSlotBaseRewardIncrease) {
						summary += `\n   - The base reward of your even-numbered bounty slots has increased (max: ${evenSlotBaseRewardIncrease} Reward XP in Slot #2)!`;
					}
				}
			} else {
				summary += `\n- Gained ${receipt.xp} XP${receipt.xpMultiplier ?? ""}!`;
			}
		}
		if ("topPlacement" in receipt) {
			summary += `\n- ${italic("Claimed the lead on Seasonal XP!")}`;
		}
		if ("rankUp" in receipt) {
			summary += `\n- Ranked up to ${bold(receipt.rankUp.name)}`;
		}
		if ("item" in receipt) {
			summary += `\n- Found a ${bold(receipt.item)}`;
		}
	}

	if (summary.length > MessageLimits.MaximumLength) {
		return `${heading("Message overflow!", 2)}\nMany people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
	} else {
		return summary;
	}
}

module.exports = {
	commandMention,
	randomCongratulatoryPhrase,
	fillableTextBar,
	emojiFromNumber,
	sentenceListEN,
	rewardSummary
}
