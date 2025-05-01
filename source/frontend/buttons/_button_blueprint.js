const { ButtonWrapper } = require('../classes');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Specs */
	(interaction, runMode, args) => {

	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
