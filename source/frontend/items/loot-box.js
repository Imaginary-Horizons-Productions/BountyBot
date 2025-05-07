const { MessageFlags, bold } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { commandMention, listifyEN } = require("../shared");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "Loot Box";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Unboxes into 2 random items!", 3000,
		async (interaction) => {
			const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.user.id, interaction.guild.id);
			const rolledItems = [];
			for (let i = 0; i < 2; i++) {
				const [itemRow] = await logicLayer.items.rollItemForHunter(1, hunter);
				if (itemRow) {
					rolledItems.push(`a ${bold(itemRow.itemName)}`);
				}
			}
			interaction.reply({ content: `Inside the Loot Box was ${listifyEN(rolledItems)}! Use one with ${commandMention("item")}?`, flags: MessageFlags.Ephemeral });
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
