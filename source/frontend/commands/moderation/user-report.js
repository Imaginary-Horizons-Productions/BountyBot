const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { userReportEmbed } = require("../../shared");
const { ensureUserFromSlashOptionHasBountyHunter } = require("../_earlyOuts");

module.exports = new SubcommandWrapper("user-report", "Get the BountyBot moderation stats for a user",
	ensureUserFromSlashOptionHasBountyHunter("user", async function executeSubcommand(interaction, theater, isDevMode, logicLayer, { member, hunter }) {
		const dqCount = await logicLayer.seasons.getDQCount(member.id, interaction.guild.id);
		const lastFiveBounties = await logicLayer.bounties.findHuntersLastFiveBounties(member.id, interaction.guildId);
		interaction.reply({ embeds: [await userReportEmbed(hunter, interaction.guild, member, dqCount, lastFiveBounties)], flags: MessageFlags.Ephemeral });
	})
).setOptions(
	{
		type: "User",
		name: "user",
		description: "The mention of the user",
		required: true
	}
);
