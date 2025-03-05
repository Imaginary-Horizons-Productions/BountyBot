const { MessageFlags } = require("discord.js");
const { ItemTemplate } = require("../classes");
const { rollItemDrop } = require("../util/itemUtil");
const { commandMention } = require("../util/textUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Unidentified Item";
module.exports = new ItemTemplate(itemName, "Rolls as a random item!", 3000,
	async (interaction, database) => {
		const rolledItem = rollItemDrop(1);
		logicLayer.items.grantItem(interaction.user.id, rolledItem);
		interaction.reply({ content: `The unidentified item was a **${rolledItem}**! Use it with ${commandMention("item")}?`, flags: [MessageFlags.Ephemeral] });
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
