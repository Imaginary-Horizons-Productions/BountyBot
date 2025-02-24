const { MessageFlags } = require("discord.js");
const { Item } = require("../classes");
const { rollItemDrop } = require("../util/itemUtil");
const { commandMention } = require("../util/textUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Unidentified Item";
module.exports = new Item(itemName, "Rolls as a random item!", 3000,
	async (interaction, database) => {
		const rolledItem = rollItemDrop(1);
		const [itemRow, itemWasCreated] = await database.models.Item.findOrCreate({ where: { userId: interaction.user.id, itemName: rolledItem } });
		if (!itemWasCreated) {
			itemRow.increment("count");
		}
		interaction.reply({ content: `The unidentified item was a **${rolledItem}**! Use it with ${commandMention("item")}?`, flags: [MessageFlags.Ephemeral] });
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
