const { PermissionFlagsBits, InteractionContextType, MessageFlags, roleMention, AttachmentBuilder, heading } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { MAX_MESSAGE_CONTENT_LENGTH } = require("../constants.js");

/** @type {typeof import("../logic/index.js")} */
let logicLayer;

const mainId = "seasonal-ranks";
module.exports = new CommandWrapper(mainId, "Look up this server's seasonal ranks", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.Guild], 3000,
	async (interaction, runMode) => {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		if (!ranks || !ranks.length) {
			interaction.reply({ content: `Could not find any seasonal ranks. Please contact a server admin to make sure this isn't a mistake.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		const content = `${heading("Seasonal Ranks", 1)}\nBounty Hunters who earn more XP compared to their contemporaries are given special roles to distinguish themselves for the season. These roles are as follows:\n\n${ranks.map((rank, index) => {
			return `${rank.rankmoji ? `${rank.rankmoji} ` : ""}${rank.roleId ? roleMention(rank.roleId) : `Rank ${index}`}\nVariance Threshold: ${rank.varianceThreshold}\n`;
		}).join('\n')}`;

		const messagePayload = { flags: [MessageFlags.Ephemeral] };
		if (content.length < MAX_MESSAGE_CONTENT_LENGTH) { // Send large content as a text file
			messagePayload.content = content;
		} else {
			messagePayload.files = [new AttachmentBuilder(Buffer.from(content, 'utf16le'), { name: 'ranks.txt' })];
		}

		interaction.reply(messagePayload);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
