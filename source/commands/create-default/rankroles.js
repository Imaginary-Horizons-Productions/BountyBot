const { CommandInteraction, GuildPremiumTier } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const roles = await interaction.guild.roles.fetch().then(existingGuildRoles => {
		return Promise.all(
			[
				{
					name: "Platinum Rank",
					color: "#669999",
					icon: "./source/images/BountyBotIcon.jpg",
					reason: "/create-default rank-roles"
				},
				{
					name: "Gold Rank",
					color: "#daa520",
					icon: "./source/images/BountyBotIcon.jpg",
					reason: "/create-default rank-roles"
				},
				{
					name: "Silver Rank",
					color: "#ccccff",
					icon: "./source/images/BountyBotIcon.jpg",
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
	const varianceThresholds = [2.5, 1, 0, -3];
	const rankmojis = ["🏆", "🥇", "🥈", "🥉"];

	database.models.Rank.bulkCreate(roles.map((role, index) => ({
		companyId: interaction.guildId,
		varianceThreshold: varianceThresholds[index],
		roleId: role.id,
		rankmoji: rankmojis[index]
	})));
	interaction.reply({ content: `Created roles: ${roles.map((role, index) => `${rankmojis[index]} ${role} at ${varianceThresholds[index]} standard deviations`).join(", ")}`, ephemeral: true });
};

module.exports = {
	data: {
		name: "rank-roles",
		description: "Create Discord roles and set them as this server's ranks at default variance thresholds"
	},
	executeSubcommand
};
