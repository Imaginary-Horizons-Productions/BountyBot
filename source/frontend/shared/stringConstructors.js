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

module.exports = {
	commandMention,
	randomCongratulatoryPhrase,
	fillableTextBar
}
