const { MessageFlags } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { rollItemDrop } = require("../util/itemUtil");
const { commandMention } = require("../util/textUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Unidentified Item";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Rolls as a random item!", 3000,
		async (interaction) => {
			const rolledItem = rollItemDrop(1);
			await logicLayer.items.grantItem(interaction.user.id, rolledItem);
			interaction.reply({ content: `The unidentified item was a **${rolledItem}**! Use it with ${commandMention("item")}?`, flags: [MessageFlags.Ephemeral] });
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
