const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { syncRankRoles } = require("../../shared");

module.exports = new SubcommandWrapper("edit", "Change the role or rankmoji for a seasonal rank",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const varianceThreshold = interaction.options.getNumber("variance-threshold");
		const rank = await logicLayer.ranks.findOneRank(interaction.guild.id, varianceThreshold);
		if (!rank) {
			interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, flags: MessageFlags.Ephemeral });
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
		const season = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks);
		syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
		interaction.reply({ content: `The seasonal rank ${newRankmoji ? `${newRankmoji} ` : ""}at ${varianceThreshold} standard deviations above mean season xp was updated${newRole ? ` to give the role ${newRole}` : ""}.`, flags: MessageFlags.Ephemeral });
	}
).setOptions(
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
);
