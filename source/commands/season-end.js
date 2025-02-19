const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { buildCompanyStatsEmbed, updateScoreboard } = require('../util/embedUtil');
const { findOneSeason, createSeason } = require('../logic/seasons');

const mainId = "season-end";
module.exports = new CommandWrapper(mainId, "Start a new season for this server, resetting ranks and placements", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	/** End the Company's current season and start a new one */
	async (interaction, database, runMode) => {
		const company = await database.models.Company.findByPk(interaction.guildId);
		if (!company) {
			interaction.reply({ content: "This server hasn't used BountyBot yet, so it doesn't have a season to end.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		buildCompanyStatsEmbed(interaction.guild, database).then(async embed => {
			const seasonBeforeEndingSeason = await findOneSeason(interaction.guildId, "previous");
			if (seasonBeforeEndingSeason) {
				seasonBeforeEndingSeason.isPreviousSeason = false;
				seasonBeforeEndingSeason.save();
			}
			const endingSeason = await findOneSeason(interaction.guildId, "current");
			const shoutouts = [];
			if (endingSeason) {
				const firstPlace = await database.models.Participation.findOne({ where: { companyId: interaction.guildId, seasonId: endingSeason.id, placement: 1 } });
				if (firstPlace) {
					shoutouts.push(`<@${firstPlace.userId}> earned the most XP this season!`);
				}
				const mostPostingsCompleted = await database.models.Participation.findOne({ where: { companyId: interaction.guildId, seasonId: endingSeason.id }, order: [["postingsCompleted", "DESC"]] });
				if (mostPostingsCompleted?.postingsCompleted > 0) {
					shoutouts.push(`<@${mostPostingsCompleted.userId}> posted the most completed bounties this season!`);
				}
				const mostToastsRaised = await database.models.Participation.findOne({ where: { companyId: interaction.guildId, seasonId: endingSeason.id }, order: [["toastsRaised", "DESC"]] });
				if (mostToastsRaised?.toastsRaised > 0) {
					shoutouts.push(`<@${mostToastsRaised.userId}> raised the most toasts this season!`);
				}
				const mostGoalContributions = await database.models.Participation.findOne({ where: { companyId: interaction.guildId, seasonId: endingSeason.id }, order: [["goalContributions", "DESC"]] });
				if (mostGoalContributions?.goalContributions > 0) {
					shoutouts.push(`<@${mostGoalContributions.userId}> made the most goal contributions this season!`);
				}
				endingSeason.isCurrentSeason = false;
				endingSeason.isPreviousSeason = true;
				endingSeason.save();
			}
			await createSeason(interaction.guildId);
			const ranks = await database.models.Rank.findAll({ where: { companyId: interaction.guild.id }, order: [["varianceThreshold", "DESC"]] });
			const roleIds = ranks.filter(rank => rank.roleId != "").map(rank => rank.roleId);
			if (roleIds.length > 0) {
				const allHunters = await database.models.Hunter.findAll({ where: { companyId: interaction.guildId } });
				interaction.guild.members.fetch({ user: allHunters.map(hunter => hunter.userId) }).then(memberCollection => {
					for (const member of memberCollection.values()) {
						if (member.manageable) {
							member.roles.remove(roleIds);
						}
					}
				})
			}
			await database.models.Hunter.update({ rank: null, nextRankXP: null }, { where: { companyId: company.id } });
			updateScoreboard(company, interaction.guild, database);
			let announcementText = "A new season has started, ranks and placements have been reset!";
			if (shoutouts.length > 0) {
				announcementText += `\n## Shoutouts\n- ${shoutouts.join("\n- ")}`;
			}
			interaction.reply(company.sendAnnouncement({ content: announcementText, embeds: [embed] }));
		})
	}
);
