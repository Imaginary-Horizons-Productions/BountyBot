const { PermissionFlagsBits, AttachmentBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { commandMention } = require('../util/textUtil.js');
const { MAX_MESSAGE_CONTENT_LENGTH } = require('../constants.js');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "inventory";
module.exports = new CommandWrapper(mainId, "Show your inventory of usable items", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	(interaction, database, runMode) => {
		logicLayer.items.getInventory(interaction.user.id).then(itemRows => {
			let content = `Here are the items in your inventory (use them with ${commandMention("item")}):\n- `;
			if (itemRows.length > 0) {
				content += `${itemRows.map(row => `${row.itemName} x ${row.count}`).join("\n- ")}`;
			} else {
				content += "(None yet, do some bounties to find some!)";
			}
			if (content.length < MAX_MESSAGE_CONTENT_LENGTH) {
				interaction.reply({ content, flags: [MessageFlags.Ephemeral] });
			} else {
				interaction.reply({
					files: [new AttachmentBuilder(Buffer.from(content), { name: "inventory.txt" })],
					flags: [MessageFlags.Ephemeral]
				});
			}
		});
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
