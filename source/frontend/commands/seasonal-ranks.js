const { PermissionFlagsBits, InteractionContextType, MessageFlags, roleMention, heading } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { contentOrFileMessagePayload } = require('../shared/dAPIRequests.js');

/** @type {typeof import("../../logic")} */
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
		interaction.reply(contentOrFileMessagePayload(content, { flags: [MessageFlags.Ephemeral] }, "ranks.txt"));
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
