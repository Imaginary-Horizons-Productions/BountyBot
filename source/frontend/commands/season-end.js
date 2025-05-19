const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { Hunter } = require('../../database/models');
const { COMPANY_XP_COEFFICIENT } = require('../../constants');
const { sendAnnouncement, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, statsEmbed } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "season-end";
module.exports = new CommandWrapper(mainId, "Start a new season for this server, resetting ranks and placements", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	/** End the Company's current season and start a new one */
	async (interaction, runMode) => {
		const guild = interaction.guild;
		const company = await logicLayer.companies.findCompanyByPK(guild.id);
		if (!company) {
			interaction.reply({ content: "This server hasn't used BountyBot yet, so it doesn't have a season to end.", flags: MessageFlags.Ephemeral });
			return;
		}

		const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
		const currentCompanyLevel = company.getLevel(allHunters);
		const currentLevelThreshold = Hunter.xpThreshold(currentCompanyLevel, COMPANY_XP_COEFFICIENT);
		const nextLevelThreshold = Hunter.xpThreshold(currentCompanyLevel + 1, COMPANY_XP_COEFFICIENT);
		const [currentSeason] = await logicLayer.seasons.findOrCreateCurrentSeason(guild.id);
		const lastSeason = await logicLayer.seasons.findOneSeason(guild.id, "previous");
		const participantCount = await logicLayer.seasons.getParticipantCount(currentSeason.id);
		statsEmbed(company, guild, allHunters, participantCount, currentLevelThreshold, nextLevelThreshold, currentSeason, lastSeason).then(async embed => {
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
				const mostPostingsCompleted = await logicLayer.seasons.findParticipationWithTopParticipationStat(interaction.guildId, endingSeason.id, "postingsCompleted");
				if (mostPostingsCompleted) {
					shoutouts.push(`<@${mostPostingsCompleted.userId}> posted the most completed bounties this season!`);
				}
				const mostToastsRaised = await logicLayer.seasons.findParticipationWithTopParticipationStat(interaction.guildId, endingSeason.id, "toastsRaised");
				if (mostToastsRaised) {
					shoutouts.push(`<@${mostToastsRaised.userId}> raised the most toasts this season!`);
				}
				const mostGoalContributions = await logicLayer.seasons.findParticipationWithTopParticipationStat(interaction.guildId, endingSeason.id, "goalContributions");
				if (mostGoalContributions) {
					shoutouts.push(`<@${mostGoalContributions.userId}> made the most goal contributions this season!`);
				}
				endingSeason.isCurrentSeason = false;
				endingSeason.isPreviousSeason = true;
				endingSeason.save();
			}
			await logicLayer.seasons.createSeason(interaction.guildId);
			const ranks = await logicLayer.ranks.findAllRanks(interaction.guildId);
			const roleIds = ranks.filter(rank => rank.roleId != "").map(rank => rank.roleId);
			const allHunters = await logicLayer.hunters.findCompanyHunters(guild.id);
			if (roleIds.length > 0) {
				guild.members.fetch({ user: allHunters.map(hunter => hunter.userId) }).then(memberCollection => {
					for (const member of memberCollection.values()) {
						if (member.manageable) {
							member.roles.remove(roleIds);
						}
					}
				})
			}
			const embeds = [];
			const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
			if (company.scoreboardIsSeasonal) {
				embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, new Map(), ranks, goalProgress));
			} else {
				embeds.push(await overallScoreboardEmbed(company, interaction.guild, allHunters, ranks, goalProgress));
			}
			updateScoreboard(company, guild, embeds);
			let announcementText = "A new season has started, ranks and placements have been reset!";
			if (shoutouts.length > 0) {
				announcementText += `\n## Shoutouts\n- ${shoutouts.join("\n- ")}`;
			}
			interaction.reply(sendAnnouncement(company, { content: announcementText, embeds: [embed] }));
		})
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
