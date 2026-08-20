import { MessageFlags, SlashCommandUserOption } from "discord.js";
import { SubcommandFunctionality } from "../../classes";
import { userReportEmbed } from "../../shared";
import { ensureUserFromSlashOptionHasBountyHunter } from "../_earlyOuts";

const userOption = new SlashCommandUserOption().setName("user")
	.setDescription("The mention of the user")
	.setRequired(true);

export default new SubcommandFunctionality("user-report", "Get the BountyBot moderation stats for a user",
	ensureUserFromSlashOptionHasBountyHunter(userOption.name, async function executeSubcommand(interaction, theater, isDevMode, logicLayer, { member, hunter }) {
		const dqCount = await logicLayer.seasons.getDQCount(member.id, interaction.guild.id);
		const lastFiveBounties = await logicLayer.bounties.findHuntersLastFiveBounties(member.id, interaction.guildId);
		interaction.reply({ embeds: [await userReportEmbed(hunter, interaction.guild, member, dqCount, lastFiveBounties)], flags: MessageFlags.Ephemeral });
	})
).setOptions(userOption);
