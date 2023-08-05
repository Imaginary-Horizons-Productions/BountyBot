const { InteractionWrapper } = require("../classes");

/** @type {Record<string, InteractionWrapper>} */
const selectDictionary = {};

for (const file of [
	"bountyeditselect.js",
	"bountypostselect.js",
	"bountyswapbounty.js",
	"bountyswapslot.js",
	"bountytakedown.js",
	"evergreeneditselect.js",
	"evergreentakedown.js",
	"modtakedown.js"
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
