const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { updateScoreboard } = require('../util/embedUtil');
const { Hunter } = require('../models/users/Hunter');
const { COMPANY_XP_COEFFICIENT } = require('../constants');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "season-end";
module.exports = new CommandWrapper(mainId, "Start a new season for this server, resetting ranks and placements", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	/** End the Company's current season and start a new one */
	async (interaction, database, runMode) => {
		const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
		if (!company) {
			interaction.reply({ content: "This server hasn't used BountyBot yet, so it doesn't have a season to end.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const currentLevelThreshold = Hunter.xpThreshold(company.level, COMPANY_XP_COEFFICIENT);
		const nextLevelThreshold = Hunter.xpThreshold(company.level + 1, COMPANY_XP_COEFFICIENT);
		const [currentSeason] = await logicLayer.seasons.findOrCreateCurrentSeason(guild.id);
		const lastSeason = await logicLayer.seasons.findOneSeason(guild.id, "previous");
		const participantCount = await logicLayer.seasons.getParticipantCount(currentSeason.id);
		company.statsEmbed(interaction.guild, participantCount, currentLevelThreshold, nextLevelThreshold, currentSeason, lastSeason).then(async embed => {
			const seasonBeforeEndingSeason = await logicLayer.seasons.findOneSeason(interaction.guildId, "previous");
			if (seasonBeforeEndingSeason) {
				seasonBeforeEndingSeason.isPreviousSeason = false;
				seasonBeforeEndingSeason.save();
			}
			const endingSeason = await logicLayer.seasons.findOneSeason(interaction.guildId, "current");
			const shoutouts = [];
			if (endingSeason) {
				const firstPlace = await logicLayer.seasons.findFirstPlaceParticipation(interaction.guildId, endingSeason.id);
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
			await logicLayer.seasons.createSeason(interaction.guildId);
			const ranks = await logicLayer.ranks.findAllRanks(interaction.guildId, "descending");
			const roleIds = ranks.filter(rank => rank.roleId != "").map(rank => rank.roleId);
			if (roleIds.length > 0) {
				const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
				interaction.guild.members.fetch({ user: allHunters.map(hunter => hunter.userId) }).then(memberCollection => {
					for (const member of memberCollection.values()) {
						if (member.manageable) {
							member.roles.remove(roleIds);
						}
					}
				})
			}
			await logicLayer.hunters.resetCompanyRanks(company.id);
			company.updateScoreboard(interaction.guild, logicLayer);
			let announcementText = "A new season has started, ranks and placements have been reset!";
			if (shoutouts.length > 0) {
				announcementText += `\n## Shoutouts\n- ${shoutouts.join("\n- ")}`;
			}
			interaction.reply(company.sendAnnouncement({ content: announcementText, embeds: [embed] }));
		})
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
