const { MessageFlags, unorderedList } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { syncRankRoles } = require("../../shared");

module.exports = new SubcommandWrapper("edit", "Change the role or rankmoji for a seasonal rank",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const threshold = interaction.options.getNumber("variance-threshold");
		const rank = await logicLayer.ranks.findOneRank(interaction.guild.id, threshold);
		if (!rank) {
			interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${threshold}.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const updateOptions = {};
		let response = "The seasonal rank ";
		const errors = [];

		const newRankmoji = interaction.options.getString("rankmoji");
		if (newRankmoji) {
			updateOptions.rankmoji = newRankmoji;
			response += `${newRankmoji} `;
		}

		response += `at ${threshold} standard deviations above mean season xp was updated`;

		const newRole = interaction.options.getRole("role");
		if (newRole) {
			const bountybotGuildMember = await interaction.guild.members.fetchMe();
			if (interaction.guild.roles.comparePositions(bountybotGuildMember.roles.highest, newRole) > 0) {
				updateOptions.roleId = newRole.id;
				response += ` to give the role ${newRole}`;
			} else {
				errors.push(`Did not assign ${newRole} to the rank. ${bountybotGuildMember} would not be able to add or remove the role from bounty hunters (none of ${bountybotGuildMember}'s roles are above it).`);
			}
		}

		response += ".";
		if (errors.length > 0) {
			response += ` However, the following errors were encountered:\n${unorderedList(errors)}`;
		}

		rank.update(updateOptions);
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
		interaction.reply({ content: response, flags: MessageFlags.Ephemeral });
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
