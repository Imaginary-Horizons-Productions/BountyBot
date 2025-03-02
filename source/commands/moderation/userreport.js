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

	const dqCount = await database.models.Participation.sum("dqCount", { where: { companyId: interaction.guild.id, userId: member.id } }) ?? 0;
	const lastFiveBounties = await database.models.Bounty.findAll({ where: { userId: member.id, companyId: interaction.guild.id, state: "completed" }, order: [["completedAt", "DESC"]], limit: 5, include: database.models.Bounty.Completions });
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
