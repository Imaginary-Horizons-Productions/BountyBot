const { SelectWrapper } = require('../classes');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "";
module.exports = new SelectWrapper(mainId, 3000,
	/** Specs */
	(interaction, args, runMode) => {

	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
