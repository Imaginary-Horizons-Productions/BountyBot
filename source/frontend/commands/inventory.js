const { PermissionFlagsBits, InteractionContextType, MessageFlags, unorderedList } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { commandMention, attachOverflowingContentAsFile } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "inventory";
module.exports = new CommandWrapper(mainId, "Show your inventory of usable items", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	(interaction, origin, runMode) => {
		logicLayer.items.getInventory(interaction.user.id).then(inventoryMap => {
			let content = `Here are the items in your inventory (use them with ${commandMention("item")}):\n`;
			if (inventoryMap.size > 0) {
				content += unorderedList(Array.from(inventoryMap.entries()).map(([itemName, count]) => `${itemName} x ${count}`));
			} else {
				content += "(None yet, do some bounties to find some!)";
			}
			interaction.reply(attachOverflowingContentAsFile(content, { flags: MessageFlags.Ephemeral }, "inventory.txt"));
		});
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
