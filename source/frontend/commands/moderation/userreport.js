const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { modStatsEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("user-report", "Get the BountyBot moderation stats for a user",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const member = interaction.options.getMember("user");
		const hunter = await logicLayer.hunters.findOneHunter(member.id, interaction.guild.id);
		if (!hunter) {
			interaction.reply({ content: `${member} has not interacted with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const dqCount = await logicLayer.seasons.getDQCount(member.id, interaction.guild.id);
		const lastFiveBounties = await logicLayer.bounties.findHuntersLastFiveBounties(member.id, interaction.guildId);
		interaction.reply({ embeds: [modStatsEmbed(hunter, interaction.guild, member, dqCount, lastFiveBounties)], flags: MessageFlags.Ephemeral });
	}
).setOptions(
	{
		type: "User",
		name: "user",
		description: "The mention of the user",
		required: true
	}
);
