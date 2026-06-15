import { MessageFlags } from 'discord.js';
import { DatabaseTypes } from '../../database';
import { LogicLayer } from '../../logic';
import { ButtonFunctionality } from '../classes';
import { consolidateHunterReceipts, goalCompletionEmbed, refreshReferenceChannelScoreboardOverall, refreshReferenceChannelScoreboardSeasonal, rewardSummary, sendRewardMessage, syncRankRoles, toastEmbed } from '../shared';

let logicLayer: LogicLayer;

const mainId = "secondtoast";
export default new ButtonFunctionality(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, theater, isDevMode, [toastId]) => {
		const originalToast = await logicLayer.toasts.findToastByPK(toastId);
		if (!originalToast) {
			interaction.reply({ content: "Database record of this toast could not be found.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (!isDevMode && originalToast.senderId === interaction.user.id) {
			interaction.reply({ content: "You cannot second your own toast.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (await logicLayer.toasts.wasAlreadySeconded(toastId, interaction.user.id)) {
			interaction.reply({ content: "You've already seconded this toast.", flags: MessageFlags.Ephemeral });
			return;
		}

		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
		const previousCompanyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));

		const recipientIds = (await originalToast.getRecipients()).map(receipt => receipt.recipientId);

		const hunterReceipts = await logicLayer.toasts.secondToast(theater.hunter, originalToast, theater.company, recipientIds, season.id);

		const { companyReceipt, goalProgress } = await logicLayer.goals.progressGoal(theater.company, "secondings", theater.hunter, season);
		companyReceipt.guildName = interaction.guild.name;

		const currentCompanyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));
		if (previousCompanyLevel < currentCompanyLevel) {
			companyReceipt.levelUp = currentCompanyLevel;
		}

		interaction.update({ embeds: [toastEmbed(theater.company.toastThumbnailURL, originalToast.text, recipientIds, await interaction.guild.members.fetch(originalToast.senderId), goalProgress, originalToast.imageURL, await logicLayer.toasts.findSecondingMentions(originalToast.id))] });
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
		consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
		sendRewardMessage(interaction.message, `${interaction.member.displayName} seconded this toast!\n${rewardSummary("seconding", companyReceipt, hunterReceipts, theater.company.maxSimBounties)}`, "Rewards");
		if (theater.company.scoreboardIsSeasonal) {
			refreshReferenceChannelScoreboardSeasonal(theater.company, interaction.guild, participationMap, descendingRanks, goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(theater.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), goalProgress);
		}

		if (goalProgress.goalCompleted && interaction.channel?.isSendable()) {
			interaction.channel.send({
				embeds: [goalCompletionEmbed(goalProgress.contributorIds)]
			});
		}
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
