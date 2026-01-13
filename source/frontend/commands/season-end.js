const { PermissionFlagsBits, InteractionContextType, unorderedList } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { sendAnnouncement, refreshReferenceChannelScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, companyStatsEmbed } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "season-end";
module.exports = new CommandWrapper(mainId, "Start a new season for this server, resetting ranks and placements", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	/** End the Company's current season and start a new one */
	async (interaction, origin, runMode) => {
		const guild = interaction.guild;
		const hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
		const [currentSeason] = await logicLayer.seasons.findOrCreateCurrentSeason(guild.id);
		const lastSeason = await logicLayer.seasons.findOneSeason(guild.id, "previous");
		const participantCount = await logicLayer.seasons.getParticipantCount(currentSeason.id);
		companyStatsEmbed(guild, origin.company.getXP(hunterMap), participantCount, currentSeason, lastSeason).then(async embed => {
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
			if (roleIds.length > 0) {
				guild.members.fetch({ user: Array.from(hunterMap.keys()) }).then(memberCollection => {
					for (const member of memberCollection.values()) {
						if (member.manageable) {
							member.roles.remove(roleIds);
						}
					}
				})
			}
			const embeds = [];
			const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
			if (origin.company.scoreboardIsSeasonal) {
				embeds.push(await seasonalScoreboardEmbed(origin.company, interaction.guild, new Map(), ranks, goalProgress));
			} else {
				embeds.push(await overallScoreboardEmbed(origin.company, interaction.guild, hunterMap, goalProgress));
			}
			refreshReferenceChannelScoreboard(origin.company, guild, embeds);
			let announcementText = "A new season has started, ranks and placements have been reset!";
			if (shoutouts.length > 0) {
				announcementText += `\n## Shoutouts\n${unorderedList(shoutouts)}`;
			}
			interaction.reply(sendAnnouncement(origin.company, { content: announcementText, embeds: [embed] }));
		})
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
