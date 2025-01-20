const { SelectWrapper } = require("../classes");

/** @type {Record<string, SelectWrapper>} */
const selectDictionary = {};

for (const file of [
]) {
	/** @type {SelectWrapper} */
	const select = require(`./${file}`);
	selectDictionary[select.mainId] = select;
}

/** @param {string} mainId */
exports.getSelect = function (mainId) {
	return selectDictionary[mainId];
}

exports.setLogic = function (logicBlob) {
	for (select in selectDictionary) {
		select.setLogic?.(logicBlob);
	}
}
