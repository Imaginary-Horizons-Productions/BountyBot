const { ButtonWrapper } = require("../classes");

/** @type {Record<string, ButtonWrapper>} */
const buttonDictionary = {};

for (const file of [
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

exports.setLogic = function (logicBlob) {
	for (const buttonKey in buttonDictionary) {
		buttonDictionary[buttonKey].setLogic?.(logicBlob);
	}
}

exports.updateCooldownMap = function(map) {
	for (const commandKey in buttonDictionary) {
		map[commandKey] = buttonDictionary[commandKey].cooldown;
	}
}
