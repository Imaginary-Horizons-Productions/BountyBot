const { CommandInteraction, GuildPremiumTier, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
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

	const ranks = await logicLayer.ranks.createDefaultRanks(interaction.guild.id, roles);
	interaction.reply({ content: `Created roles: ${roles.map((role, index) => `${ranks[index].rankmoji} ${role} at ${ranks[index].varianceThreshold} standard deviations`).join(", ")}`, flags: [MessageFlags.Ephemeral] });
};

module.exports = {
	data: {
		name: "rank-roles",
		description: "Create Discord roles and set them as this server's ranks at default variance thresholds"
	},
	executeSubcommand
};
