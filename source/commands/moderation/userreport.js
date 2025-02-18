const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { buildModStatsEmbed } = require("../../util/embedUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const member = interaction.options.getMember("user");
	const hunter = await database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: member.id } });
	if (!hunter) {
		interaction.reply({ content: `${member} has not interacted with BountyBot on this server.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	buildModStatsEmbed(interaction.guild, member, hunter, database).then(embed => {
		interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
	});
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
