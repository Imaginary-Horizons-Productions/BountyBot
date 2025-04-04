const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("remove", "Remove an existing seasonal rank",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const varianceThreshold = interaction.options.getNumber("variance-threshold");
		const rank = await logicLayer.ranks.findOneRank(interaction.guild.id, varianceThreshold);
		if (!rank) {
			interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		if (rank.roleId) {
			interaction.guild.ranks.delete(rank.roleId, 'Removing rank role during rank removal.')
		}
		rank.destroy();
		interaction.reply({ content: "The rank has been removed.", flags: [MessageFlags.Ephemeral] });
	}
).setOptions(
	{
		type: "Number",
		name: "variance-threshold",
		description: "The variance threshold of the rank to review",
		required: true
	}
);
