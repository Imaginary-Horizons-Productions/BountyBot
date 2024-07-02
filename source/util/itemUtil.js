/** pool picker range: 0-120
 * @type {Record<number, string[]>} key as theshold to get to pool defined by string array
 */
const DROP_TABLE = {
	90: [
		"XP Boost",
		"Bonus Bounty Showcase"
	],
	0: [
		"Aqua Profile Colorizer",
		"Blue Profile Colorizer",
		"Blurple Profile Colorizer",
		"Dark Aqua Profile Colorizer",
		"Dark Blue Profile Colorizer",
		"Dark But Not Black Profile Colorizer",
		"Darker Grey Profile Colorizer",
		"Dark Gold Profile Colorizer",
		"Dark Green Profile Colorizer",
		"Dark Grey Profile Colorizer",
		"Dark Navy Profile Colorizer",
		"Dark Orange Profile Colorizer",
		"Dark Purple Profile Colorizer",
		"Dark Red Profile Colorizer",
		"Dark Vivid Pink Profile Colorizer",
		"Default Profile Colorizer",
		"Fuchsia Profile Colorizer",
		"Gold Profile Colorizer",
		"Green Profile Colorizer",
		"Grey Profile Colorizer",
		"Greyple Profile Colorizer",
		"Light Grey Profile Colorizer",
		"Luminous Vivid Pink Profile Colorizer",
		"Orange Profile Colorizer",
		"Purple Profile Colorizer",
		"Red Profile Colorizer",
		"White Profile Colorizer",
		"Yellow Profile Colorizer",
	]
};

/** @param {number} dropRate as a decimal between 0 and 1 (exclusive) */
function rollItemDrop(dropRate) {
	if (Math.random() < dropRate) {
		const poolThresholds = Object.keys(DROP_TABLE).map(unparsed => parseFloat(unparsed)).sort((a, b) => b - a);
		const poolRandomNumber = Math.random() * 120;
		for (const threshold of poolThresholds) {
			if (poolRandomNumber > threshold) {
				const pool = DROP_TABLE[threshold];
				return pool[Math.floor(Math.random() * pool.length)];
			}
		}
	}
	return null;
}

module.exports = {
	rollItemDrop
}
