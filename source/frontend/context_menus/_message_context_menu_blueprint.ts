import { InteractionContextType } from 'discord.js';
import type { LogicLayer } from '../../logic';
import { MessageContextMenuFunctionality } from '../classes/index.ts';

let logicLayer: LogicLayer;

const mainId = "";
export default new MessageContextMenuFunctionality(mainId, null, false, [InteractionContextType.Guild], 3000,
	/** Specs */
	(interaction, theater, isDevMode) => {

	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
