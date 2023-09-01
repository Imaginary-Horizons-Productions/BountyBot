const { InteractionWrapper } = require("../classes");

/** @type {Record<string, InteractionWrapper>} */
const selectDictionary = {};

for (const file of [
	"bountyedit.js",
	"bountypost.js",
	"bountyshowcase.js",
	"bountyswapbounty.js",
	"bountyswapslot.js",
	"bountytakedown.js",
	"evergreenedit.js",
	"evergreenshowcase.js",
	"evergreenswapbounty.js",
	"evergreenswapslot.js",
	"evergreentakedown.js",
	"modtakedown.js",
	"rafflerank.js"
]) {
	const select = require(`./${file}`);
	selectDictionary[select.customId] = select;
}

/**
 * @param {string} mainId
 */
exports.getSelect = function (mainId) {
	return selectDictionary[mainId];
}
