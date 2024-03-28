const { ButtonWrapper } = require("../classes");

/** @type {Record<string, ButtonWrapper>} */
const buttonDictionary = {};

for (const file of [
	"bbaddcompleters.js",
	"bbcomplete.js",
	"bbremovecompleters.js",
	"bbtakedown.js",
	"secondtoast.js"
]) {
	/** @type {ButtonWrapper} */
	const button = require(`./${file}`);
	buttonDictionary[button.mainId] = button;
}

/** @param {string} mainId */
exports.getButton = function (mainId) {
	return buttonDictionary[mainId];
}
