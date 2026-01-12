const { PermissionFlagsBits, InteractionContextType, MessageFlags, roleMention, heading } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { attachOverflowingContentAsFile } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "seasonal-ranks";
module.exports = new CommandWrapper(mainId, "Look up this server's seasonal ranks", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.Guild], 3000,
	async (interaction, origin, runMode) => {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		if (!ranks || !ranks.length) {
			interaction.reply({ content: `Could not find any seasonal ranks. Please contact a server admin to make sure this isn't a mistake.`, flags: MessageFlags.Ephemeral });
			return;
		}
		const content = `${heading("Seasonal Ranks", 1)}\nBounty Hunters who earn more XP compared to their contemporaries are given special roles to distinguish themselves for the season. These roles are as follows:\n\n${ranks.map((rank, index) => {
			return `${rank.rankmoji ? `${rank.rankmoji} ` : ""}${rank.roleId ? roleMention(rank.roleId) : `Rank ${index}`}\nStandard Deviations Threshold: ${rank.threshold}\n`;
		}).join('\n')}`;
		interaction.reply(attachOverflowingContentAsFile(content, { flags: MessageFlags.Ephemeral }, "ranks.txt"));
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
