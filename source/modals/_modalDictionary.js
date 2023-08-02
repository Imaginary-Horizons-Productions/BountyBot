const { InteractionWrapper } = require("../classes");

/** @type {Record<string, InteractionWrapper>} */
const modalDictionary = {};

for (const file of [
	"bountyeditmodal.js",
	"bountypostmodal.js",
	"evergreenpost.js",
	"feedback-bugreport.js",
	"feedback-featurerequest.js"
]) {
	const modal = require(`./${file}`);
	modalDictionary[modal.customId] = modal;
}

/**
 * @param {string} mainId
 */
exports.getModal = function (mainId) {
	return modalDictionary[mainId];
}
