const { SelectWrapper } = require('../classes');

/** @type {import('../../shared/types').LogicLayer} */
let logicLayer;

const mainId = "";
module.exports = new SelectWrapper(mainId, 3000,
	/** Specs */
	(interaction, theater, isDevMode, args) => {

	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
