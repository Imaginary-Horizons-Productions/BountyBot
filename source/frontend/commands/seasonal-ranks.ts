import { heading, InteractionContextType, MessageFlags, PermissionFlagsBits, roleMention } from 'discord.js';
import type { LogicLayer } from '../../logic/index.js';
import { CommandFunctionality } from '../classes/index.js';
import { attachOverflowingContentAsFile } from '../shared';

let logicLayer: LogicLayer;

const mainId = "seasonal-ranks";
export default new CommandFunctionality(mainId, "Look up this server's seasonal ranks", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.Guild], 3000,
	async (interaction, theater, isDevMode) => {
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
