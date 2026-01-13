const { commandIds } = require("../../constants");

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

module.exports = {
	commandMention,
	randomCongratulatoryPhrase,
	fillableTextBar,
	emojiFromNumber
}
