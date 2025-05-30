const { GuildPremiumTier, MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("rank-roles", "Create the default ranks for this server including Discord roles (and delete old ranks)",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		await Promise.all(
			(await logicLayer.ranks.findAllRanks(interaction.guild.id))
				.map(r => r.roleId)
				.filter(id => !!id)
				.map(id => interaction.guild.roles.delete(id, 'Cleaning up BountyBot roles during default rank creation.'))
		).catch(error => {
			if (error.code !== 10011) { // Ignore "Unknown Role" errors as we have no way to check if our stored role ids are stale
				console.error(error);
			}
		});
		const deletedCount = await logicLayer.ranks.deleteCompanyRanks(interaction.guild.id);
		const roles = await interaction.guild.roles.fetch().then(existingGuildRoles => {
			return Promise.all(
				[
					{
						name: "Platinum Rank",
						color: "#669999",
						icon: "./source/images/BountyBotIcon.jpg",
						hoist: true,
						reason: "/create-default rank-roles"
					},
					{
						name: "Gold Rank",
						color: "#daa520",
						icon: "./source/images/BountyBotIcon.jpg",
						hoist: true,
						reason: "/create-default rank-roles"
					},
					{
						name: "Silver Rank",
						color: "#ccccff",
						icon: "./source/images/BountyBotIcon.jpg",
						hoist: true,
						reason: "/create-default rank-roles"
					},
					{
						name: "Bronze Rank",
						color: "#b9722d",
						icon: "./source/images/BountyBotIcon.jpg",
						reason: "/create-default rank-roles"
					}
				].map((roleCreateOptions, index) => {
					if (interaction.guild.premiumTier < GuildPremiumTier.Tier2) {
						delete roleCreateOptions.icon;
					}
					roleCreateOptions.position = existingGuildRoles.length + index;
					return interaction.guild.roles.create(roleCreateOptions);
				})
			)
		});

		const ranks = await logicLayer.ranks.createDefaultRanks(interaction.guildId, roles.map(role => role.id));
		interaction.editReply({ content: `Created roles: ${roles.map((role, index) => `${ranks[index].rankmoji} ${role} at ${ranks[index].threshold} standard deviations`).join(", ")}${deletedCount > 0 ? `\n\nThe previous ${deletedCount} ranks and their roles were deleted.` : ""}` });
	}
);
