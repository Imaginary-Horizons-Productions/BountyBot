import { MessageFlags, bold } from "discord.js";
import type { LogicLayer } from "../../logic";
import { ItemTemplate, ItemTemplateSet } from "../classes";
import { commandMention } from "../shared";

let logicLayer: LogicLayer;

const itemName = "Unidentified Item";
export default new ItemTemplateSet(
	new ItemTemplate(itemName, "Rolls as a random item!", 3000,
		async (interaction, theater) => {
			const itemRow = await logicLayer.items.createRandomItem(theater.hunter);
			interaction.reply({ content: `The unidentified item was a ${bold(itemRow.itemName)}! Use it with ${commandMention("item")}?`, flags: MessageFlags.Ephemeral });
			return 1;
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
