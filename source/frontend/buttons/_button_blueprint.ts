import type { LogicLayer } from '../../logic';
import { ButtonFunctionality } from '../classes/index.ts';

let logicLayer: LogicLayer;

const mainId = "";
export default new ButtonFunctionality(mainId, 3000,
	/** Specs */
	(interaction, theater, isDevMode, []) => {

	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
