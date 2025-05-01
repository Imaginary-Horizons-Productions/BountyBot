const { PermissionFlagsBits, AttachmentBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { MessageLimits } = require('@sapphire/discord.js-utilities');
const { CommandWrapper } = require('../classes');
const { commandMention } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "inventory";
module.exports = new CommandWrapper(mainId, "Show your inventory of usable items", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	(interaction, runMode) => {
		logicLayer.items.getInventory(interaction.user.id).then(itemRows => {
			let content = `Here are the items in your inventory (use them with ${commandMention("item")}):\n- `;
			if (itemRows.length > 0) {
				content += `${itemRows.map(row => `${row.itemName} x ${row.count}`).join("\n- ")}`;
			} else {
				content += "(None yet, do some bounties to find some!)";
			}
			if (content.length < MessageLimits.MaximumLength) {
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
