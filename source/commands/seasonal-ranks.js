const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { MAX_MESSAGE_CONTENT_LENGTH } = require("../constants.js");

/** @type {typeof import("../logic/index.js")} */
let logicLayer;

const mainId = "seasonal-ranks";
module.exports = new CommandWrapper(mainId, "Look up this server's seasonal ranks", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.Guild], 3000,
	async (interaction, runMode) => {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		if (!ranks || !ranks.length) {
			interaction.reply({ content: `Could not find aany seasonal ranks. Please contact a server admin to make sure this isn't a mistake.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		const allRanksMsg = ranks.map((rank, index) => {
			return `${rank.rankmoji ?? ""}${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${index}`}\nVariance Threshold: ${rank.varianceThreshold}`;
		}).join('\n');

		const msgJson = { flags: [MessageFlags.Ephemeral] };
		if (allRanksMsg.length < MAX_MESSAGE_CONTENT_LENGTH) { // Send large content as a text file
			msgJson.content = allRanksMsg;
		} else {
			msgJson.files = [new AttachmentBuilder(Buffer.from(allRanksMsg, 'utf16le'), { name: 'ranks.txt' })];
		}

		interaction.reply(msgJson);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
