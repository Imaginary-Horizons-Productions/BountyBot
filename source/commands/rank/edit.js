const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getRankUpdates } = require("../../util/scoreUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const varianceThreshold = interaction.options.getNumber("variance-threshold");
	const rank = await database.models.Rank.findOne({ where: { companyId: interaction.guildId, varianceThreshold } });
	if (!rank) {
		interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, ephemeral: true });
		return;
	}

	const updateOptions = {};

	const newRole = interaction.options.getRole("role");
	if (newRole) {
		updateOptions.roleId = newRole.id;
	}

	const newRankmoji = interaction.options.getString("rankmoji");
	if (newRankmoji) {
		updateOptions.rankmoji = newRankmoji;
	}
	rank.update(updateOptions);
	getRankUpdates(interaction.guild, database);
	interaction.reply({ content: `The seasonal rank ${newRankmoji ? `${newRankmoji} ` : ""}at ${varianceThreshold} standard deviations above mean season xp was updated${newRole ? ` to give the role ${newRole}` : ""}.`, ephemeral: true });
};

module.exports = {
	data: {
		name: "edit",
		description: "Change the role or rankmoji for a seasonal rank",
		optionsInput: [
			{
				type: "Number",
				name: "variance-threshold",
				description: "The variance threshold of the rank to edit",
				required: true
			},
			{
				type: "Role",
				name: "role",
				description: "The role to give hunters that attain this rank",
				required: false
			},
			{
				type: "String",
				name: "rankmoji",
				description: "An emoji associated with this rank",
				required: false
			}
		]
	},
	executeSubcommand
};
