const { SelectWrapper } = require("../classes");

/** @type {Record<string, SelectWrapper>} */
const selectDictionary = {};

for (const file of [
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
	/** @type {SelectWrapper} */
	const select = require(`./${file}`);
	selectDictionary[select.mainId] = select;
}

/** @param {string} mainId */
exports.getSelect = function (mainId) {
	return selectDictionary[mainId];
}
