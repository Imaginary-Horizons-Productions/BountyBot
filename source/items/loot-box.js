const { MessageFlags } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { rollItemDrop } = require("../util/itemUtil");
const { commandMention } = require("../util/textUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Loot Box";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Unboxes into 2 random items!", 3000,
		async (interaction) => {
			const rolledItems = [rollItemDrop(1), rollItemDrop(1)];
			for (const droppedItem of rolledItems) {
				await logicLayer.items.grantItem(interaction.user.id, droppedItem);
			}
			interaction.reply({ content: `Inside the Loot Box was a **${rolledItems[0]}** and a **${rolledItems[1]}**! Use one with ${commandMention("item")}?`, flags: [MessageFlags.Ephemeral] });
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
