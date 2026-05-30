import { LogicLayer } from "../../shared/types";
import { ButtonFunctionality } from '../classes';

let logicLayer: LogicLayer;

const mainId = "";
export default new ButtonFunctionality(mainId, 3000,
	/** Specs */
	(interaction, theater, isDevMode, []) => {

	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
