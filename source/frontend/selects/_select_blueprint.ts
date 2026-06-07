import { LogicLayer } from "../../logic";
import { SelectFunctionality } from "../classes";

let logicLayer: LogicLayer;

const mainId = "";
export default new SelectFunctionality(mainId, 3000,
	/** Specs */
	(interaction, theater, isDevMode, args) => {

	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
