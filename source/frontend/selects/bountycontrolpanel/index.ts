import type { LogicLayer } from "../../../logic";
import { SelectFunctionality } from '../../classes/index.ts';
import { aggregateSelectOptionMap } from '../../shared/index.ts';

let logicLayer: LogicLayer;

const optionMap = await aggregateSelectOptionMap("bountycontrolpanel", [
	"complete.ts",
	"edit.ts",
	"nochange.ts",
	"ping.ts",
	"recordturnin.ts",
	"revoketurnin.ts",
	"showcase.ts",
	"swap.ts",
	"takedown.ts"
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
