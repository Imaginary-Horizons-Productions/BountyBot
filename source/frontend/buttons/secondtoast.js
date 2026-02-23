const { MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { goalCompletionEmbed, sendRewardMessage, syncRankRoles, rewardSummary, consolidateHunterReceipts, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, toastEmbed } = require('../shared');
const { Company } = require('../../database/models');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "secondtoast";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, origin, runMode, [toastId]) => {
		const originalToast = await logicLayer.toasts.findToastByPK(toastId);
		if (!originalToast) {
			interaction.reply({ content: "Database record of this toast could not be found.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (runMode === "production" && originalToast.senderId === interaction.user.id) {
			interaction.reply({ content: "You cannot second your own toast.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (await logicLayer.toasts.wasAlreadySeconded(toastId, interaction.user.id)) {
			interaction.reply({ content: "You've already seconded this toast.", flags: MessageFlags.Ephemeral });
			return;
		}

		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const previousCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));
		const recipientIds = [];
		originalToast.Recipients.forEach(reciept => {
			if (reciept.recipientId !== interaction.user.id) {
				recipientIds.push(reciept.recipientId);
			}
		});

		const hunterReceipts = await logicLayer.toasts.secondToast(origin.hunter, originalToast, origin.company, recipientIds, season.id);

		const progressData = await logicLayer.goals.progressGoal(interaction.guildId, "secondings", origin.hunter, season);
		const companyReceipt = { guildName: interaction.guild.name };
		if (progressData.gpContributed > 0) {
			companyReceipt.gpExpression = progressData.gpContributed.toString();
		}

		const currentCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));
		if (previousCompanyLevel < currentCompanyLevel) {
			companyReceipt.levelUp = currentCompanyLevel;
		}

		interaction.update({ embeds: [toastEmbed(origin.company.toastThumbnailURL, originalToast.text, recipientIds, interaction.member, progressData, originalToast.imageURL, await logicLayer.toasts.findSecondingMentions(originalToast.id))] });
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
		consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
		sendRewardMessage(interaction.message, `${interaction.member.displayName} seconded this toast!\n${rewardSummary("seconding", companyReceipt, hunterReceipts, origin.company.maxSimBounties)}`, "Rewards");
		if (origin.company.scoreboardIsSeasonal) {
			refreshReferenceChannelScoreboardSeasonal(origin.company, interaction.guild, participationMap, descendingRanks, progressData);
		} else {
			refreshReferenceChannelScoreboardOverall(origin.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), progressData);
		}

		if (progressData.goalCompleted) {
			interaction.channel.send({
				embeds: [goalCompletionEmbed(progressData.contributorIds)]
			});
		}
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
