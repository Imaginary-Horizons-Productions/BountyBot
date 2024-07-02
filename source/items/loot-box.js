const { Item } = require("../classes");
const { rollItemDrop } = require("../util/itemUtil");
const { commandMention } = require("../util/textUtil");

const itemName = "Loot Box";
module.exports = new Item(itemName, "Unboxes into 2 random items!", 3000,
	async (interaction, database) => {
		const rolledItems = [rollItemDrop(1), rollItemDrop(1)];
		for (const droppedItem of rolledItems) {
			const [itemRow, itemWasCreated] = await database.models.Item.findOrCreate({ where: { userId: interaction.user.id, itemName: droppedItem } });
			if (!itemWasCreated) {
				itemRow.increment("count");
			}
		}
		interaction.reply({ content: `Inside the Loot Box was a **${rolledItems[0]}** and a **${rolledItems[1]}**! Use one with ${commandMention("item")}?`, ephemeral: true });
	}
);
