const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const member = interaction.options.getMember("user");
	const hunter = await logicLayer.hunters.findOneHunter(member.id, interaction.guild.id);
	if (!hunter) {
		interaction.reply({ content: `${member} has not interacted with BountyBot on this server.`, flags: [MessageFlags.Ephemeral] });
		return;
	}

	const dqCount = await logicLayer.seasons.getDQCount(member.id, interaction.guild.id);
	const lastFiveBounties = await logicLayer.bounties.findHuntersLastFiveBounties(member.id, interaction.guildId);
	interaction.reply({ embeds: [hunter.modStatsEmbed(interaction.guild, member, dqCount, lastFiveBounties)], flags: [MessageFlags.Ephemeral] });
};

module.exports = {
	data: {
		name: "user-report",
		description: "Get the BountyBot moderation stats for a user",
		optionsInput: [
			{
				type: "User",
				name: "user",
				description: "The mention of the user",
				required: true
			}
		]
	},
	executeSubcommand
};
