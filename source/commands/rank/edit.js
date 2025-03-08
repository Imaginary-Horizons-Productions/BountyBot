const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getRankUpdates } = require("../../util/scoreUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const varianceThreshold = interaction.options.getNumber("variance-threshold");
	const rank = await logicLayer.ranks.findOneRank(interaction.guild.id, varianceThreshold);
	if (!rank) {
		interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, flags: [MessageFlags.Ephemeral] });
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
	getRankUpdates(interaction.guild, logicLayer);
	interaction.reply({ content: `The seasonal rank ${newRankmoji ? `${newRankmoji} ` : ""}at ${varianceThreshold} standard deviations above mean season xp was updated${newRole ? ` to give the role ${newRole}` : ""}.`, flags: [MessageFlags.Ephemeral] });
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
