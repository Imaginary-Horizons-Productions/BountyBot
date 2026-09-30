import type { LogicLayer } from "../../logic";
import { ItemTemplate, ItemTemplateSet } from "../classes/index.ts";

let logicLayer: LogicLayer;

const itemName = "";
export default new ItemTemplateSet(
	new ItemTemplate(itemName, "description", 3000,
		/** specs */
		async (interaction, theater) => {

			return 1;
		})
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
