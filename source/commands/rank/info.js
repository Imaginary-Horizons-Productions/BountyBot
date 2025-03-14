const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("info", "Get the information about an existing seasonal rank",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const varianceThreshold = interaction.options.getNumber("variance-threshold");
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		let index = 0;
		const rank = ranks.find(rank => {
			index++;
			return rank.varianceThreshold == varianceThreshold
		});

		if (!rank) {
			interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		interaction.reply({ content: `${rank.rankmoji ?? ""}${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${index}`}\nVariance Threshold: ${rank.varianceThreshold}`, flags: [MessageFlags.Ephemeral] });
	}
).setOptions(
	{
		type: "Number",
		name: "variance-threshold",
		description: "The variance threshold of the rank to view",
		required: true
	}
);
