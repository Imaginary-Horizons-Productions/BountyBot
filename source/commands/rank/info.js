const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const varianceThreshold = interaction.options.getNumber("variance-threshold");
	const ranks = await database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "DESC"]] });
	let index = 0;
	const rank = ranks.find(rank => {
		index++;
		return rank.varianceThreshold == varianceThreshold
	});

	if (!rank) {
		interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, ephemeral: true });
		return;
	}

	interaction.reply({ content: `${rank.rankmoji ?? ""}${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${index}`}\nVariance Threshold: ${rank.varianceThreshold}`, ephemeral: true });
};

module.exports = {
	data: {
		name: "info",
		description: "Get the information about an existing seasonal rank",
		optionsInput: [
			{
				type: "Number",
				name: "variance-threshold",
				description: "The variance threshold of the rank to view",
				required: true
			}
		]
	},
	executeSubcommand
};
