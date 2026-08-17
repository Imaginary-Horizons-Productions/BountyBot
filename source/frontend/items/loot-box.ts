import { MessageFlags, bold } from "discord.js";
import type { LogicLayer } from "../../logic";
import { ItemTemplate, ItemTemplateSet } from "../classes";
import { commandMention, sentenceListEN } from "../shared";

let logicLayer: LogicLayer;

const itemName = "Loot Box";
export default new ItemTemplateSet(
	new ItemTemplate(itemName, "Unboxes into 2 random items!", 3000,
		async (interaction, theater) => {
			const rolledItems = [];
			for (let i = 0; i < 2; i++) {
				const itemRow = await logicLayer.items.createRandomItem(theater.hunter);
				rolledItems.push(`a ${bold(itemRow.itemName)}`);
			}
			interaction.reply({ content: `Inside the Loot Box was ${sentenceListEN(rolledItems)}! Use one with ${commandMention("item")}?`, flags: MessageFlags.Ephemeral });
			return 1;
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
