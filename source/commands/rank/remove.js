const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const varianceThreshold = interaction.options.getNumber("variance-threshold");
	const rank = await database.models.Rank.findOne({ where: { companyId: interaction.guildId, varianceThreshold } });
	if (!rank) {
		interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, flags: [MessageFlags.Ephemeral] });
		return;
	}

	rank.destroy();
	interaction.reply({ content: "The rank has been removed.", flags: [MessageFlags.Ephemeral] });
};

module.exports = {
	data: {
		name: "remove",
		description: "Remove an existing seasonal rank",
		optionsInput: [
			{
				type: "Number",
				name: "variance-threshold",
				description: "The variance threshold of the rank to review",
				required: true
			}
		]
	},
	executeSubcommand
};
