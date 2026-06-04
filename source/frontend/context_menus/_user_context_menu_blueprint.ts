import { InteractionContextType } from 'discord.js';
import { LogicLayer } from "../../shared/types";
import { UserContextMenuFunctionality } from '../classes';

let logicLayer: LogicLayer;

const mainId = "";
export default new UserContextMenuFunctionality(mainId, null, false, [InteractionContextType.Guild], 3000,
	/** Specs */
	(interaction, theater, isDevMode) => {

	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
