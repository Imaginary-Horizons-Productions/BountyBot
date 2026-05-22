const { SelectWrapper } = require('../../classes');
const { aggregateSelectOptionMap } = require('../../shared');

/** @type {typeof import("../../../logic")} */
let logicLayer;

const optionMap = aggregateSelectOptionMap("bountycontrolpanel", [
	"complete.js",
	"edit.js",
	"nochange.js",
	"ping.js",
	"recordturnin.js",
	"revoketurnin.js",
	"showcase.js",
	"swap.js",
	"takedown.js"
]);

const mainId = "bountycontrolpanel";
module.exports = new SelectWrapper(mainId, 3000,
	/** This select menu accompanies individual bounty threads, providing an interface for the bounty's poster to interact with the bounty */
	async (interaction, origin, runMode, args) => {
		optionMap[interaction.values[0]]?.(interaction, origin, runMode, logicLayer, args);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
