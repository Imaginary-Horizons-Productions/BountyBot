import { GuildPremiumTier, MessageFlags, resolveColor, Role, RoleCreateOptions } from "discord.js";
import { SubcommandFunctionality } from "../../classes/index.ts";

const auditLogReason = "/create-default rank-roles";
const roleCreateOptions: RoleCreateOptions[] = [
	{
		name: "Platinum Rank",
		colors: { primaryColor: resolveColor("#669999") },
		icon: "./source/frontend/images/BountyBotIcon.jpg",
		hoist: true
	},
	{
		name: "Gold Rank",
		colors: { primaryColor: resolveColor("#daa520") },
		icon: "./source/frontend/images/BountyBotIcon.jpg",
		hoist: true
	},
	{
		name: "Silver Rank",
		colors: { primaryColor: resolveColor("#ccccff") },
		icon: "./source/frontend/images/BountyBotIcon.jpg",
		hoist: true
	},
	{
		name: "Bronze Rank",
		colors: { primaryColor: resolveColor("#b9722d") },
		icon: "./source/frontend/images/BountyBotIcon.jpg"
	}
];

export default new SubcommandFunctionality("rank-roles", "Create the default ranks for this server including Discord roles (and delete old ranks)",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		for (const rank of await logicLayer.ranks.findAllRanks(interaction.guild.id)) {
			if (rank.roleId) {
				interaction.guild.roles.delete(rank.roleId, auditLogReason)
					.catch(error => {
						if (error.code !== 10011) { // Ignore "Unknown Role" errors as we have no way to check if our stored role ids are stale
							console.error(error);
						}
					});
			}
		}
		const deletedCount = await logicLayer.ranks.deleteCompanyRanks(interaction.guild.id);
		const roles: Role[] = [];
		await interaction.guild.roles.fetch().then(async existingGuildRoles => {
			for (let i = 0; i < roleCreateOptions.length; i++) {
				const roleCreateOption = roleCreateOptions[i];
				if (interaction.guild.premiumTier < GuildPremiumTier.Tier2) {
					delete roleCreateOption.icon;
				}
				const role = await interaction.guild.roles.create({
					...roleCreateOptions,
					position: existingGuildRoles.size + i,
					reason: auditLogReason
				});
				roles.push(role);
			}
		});

		const ranks = await logicLayer.ranks.createDefaultRanks(interaction.guildId, roles.map(role => role.id));
		interaction.editReply({ content: `Created roles: ${roles.map((role, index) => `${ranks[index].rankmoji} ${role} at ${ranks[index].threshold} standard deviations`).join(", ")}${deletedCount > 0 ? `\n\nThe previous ${deletedCount} ranks and their roles were deleted.` : ""}` });
	}
);
