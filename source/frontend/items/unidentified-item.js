const { MessageFlags, bold } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { commandMention } = require("../shared");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "Unidentified Item";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Rolls as a random item!", 3000,
		async (interaction, origin) => {
			const [itemRow] = await logicLayer.items.rollItemForHunter(1, origin.hunter);
			interaction.reply({ content: `The unidentified item was a ${bold(itemRow.itemName)}! Use it with ${commandMention("item")}?`, flags: MessageFlags.Ephemeral });
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
