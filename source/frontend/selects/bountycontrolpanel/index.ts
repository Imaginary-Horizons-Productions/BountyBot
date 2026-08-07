import { LogicLayer } from "../../../logic";
import { SelectFunctionality } from '../../classes';
import { aggregateSelectOptionMap } from '../../shared';

let logicLayer: LogicLayer;

const optionMap = await aggregateSelectOptionMap("bountycontrolpanel", [
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
export default new SelectFunctionality(mainId, 3000,
	/** This select menu accompanies individual bounty threads, providing an interface for the bounty's poster to interact with the bounty */
	async (interaction, theater, isDevMode, args) => {
		optionMap[interaction.values[0]]?.(interaction, theater, isDevMode, logicLayer, args);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
