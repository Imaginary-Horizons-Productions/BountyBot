import { InteractionContextType, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle, userMention } from 'discord.js';
import { Company } from '../../database/models';
import { timeConversion } from '../../shared';
import { SKIP_INTERACTION_HANDLING } from '../../shared/constants';
import { LogicLayer } from "../../shared/types";
import { UserContextMenuFunctionality } from '../classes';
import { butIgnoreInteractionCollectorErrors, consolidateHunterReceipts, goalCompletionEmbed, refreshReferenceChannelScoreboardOverall, refreshReferenceChannelScoreboardSeasonal, rewardSummary, secondingButtonRow, sendRewardMessage, syncRankRoles, textsHaveAutoModInfraction, toastEmbed } from '../shared';

let logicLayer: LogicLayer;

const mainId = "Raise a Toast";
export default new UserContextMenuFunctionality(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive toast text, then raise the toast to the user */
	async (interaction, theater, isDevMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot raise a toast to yourself.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (!isDevMode && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot raist a toast to a bot.", flags: MessageFlags.Ephemeral });
			return;
		}

		const { hunter: [toastee] } = await logicLayer.hunters.findOrCreateBountyHunter(interaction.targetId, interaction.guildId);
		if (toastee.isBanned) {
			interaction.reply({ content: `${userMention(interaction.targetId)} cannot receive toasts because they are banned from interacting with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Raising a Toast")
			.addLabelComponents(
				new LabelBuilder().setLabel("Toast Message")
					.setTextInputComponent(
						new TextInputBuilder().setCustomId("message")
							.setStyle(TextInputStyle.Short)
					)
			);
		interaction.showModal(modal);
		return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
			const toastText = modalSubmission.fields.getTextInputValue("message");
			const autoModInfraction = await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [toastText], "toast");
			if (autoModInfraction == null) {
				modalSubmission.reply({ content: `Could not check if the toast breaks automod rules. ${modalSubmission.client.user} may not have the Manage Server permission required to check the automod rules.`, flags: MessageFlags.Ephemeral });
				return;
			} else if (autoModInfraction) {
				modalSubmission.reply({ content: "Your toast was blocked by AutoMod.", flags: MessageFlags.Ephemeral });
				return;
			}

			const season = await logicLayer.seasons.incrementSeasonStat(modalSubmission.guild.id, "toastsRaised");
			let hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);

			const previousCompanyLevel = Company.getLevel(theater.company.getXP(hunterMap));
			const { toastId, hunterReceipts } = await logicLayer.toasts.raiseToast(modalSubmission.guild, theater.company, interaction.user.id, [interaction.targetId], hunterMap, season.id, toastText, null);
			let goalProgress = { goalCompleted: false, currentGP: 0, requiredGP: 0 };
			let companyReceipt = {};
			if (hunterReceipts.size > 0) {
				const results = await logicLayer.goals.progressGoal(theater.company, "toasts", hunterMap[interaction.user.id], season);
				companyReceipt = results.companyReceipt;
				goalProgress = results.goalProgress;

				hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
				const currentCompanyLevel = Company.getLevel(theater.company.getXP(hunterMap));
				if (previousCompanyLevel < currentCompanyLevel) {
					companyReceipt.levelUp = currentCompanyLevel;
				}
			}
			companyReceipt.guildName = interaction.guild.name;

			const embeds = [toastEmbed(theater.company.toastThumbnailURL, toastText, [interaction.targetId], modalSubmission.member, goalProgress)];
			if (goalProgress.goalCompleted) {
				embeds.push(goalCompletionEmbed(goalProgress.contributorIds));
			}

			modalSubmission.reply({
				embeds,
				components: [secondingButtonRow(toastId)],
				withResponse: true
			}).then(async response => {
				if (hunterReceipts.size > 0) {
					const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
					const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
					const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
					syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
					consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
					const rewardString = rewardSummary("toast", companyReceipt, hunterReceipts, theater.company.maxSimBounties);
					sendRewardMessage(response.resource.message, rewardString, "Rewards");
					if (theater.company.scoreboardIsSeasonal) {
						refreshReferenceChannelScoreboardSeasonal(theater.company, modalSubmission.guild, participationMap, descendingRanks, goalProgress);
					} else {
						refreshReferenceChannelScoreboardOverall(theater.company, modalSubmission.guild, hunterMap, goalProgress);
					}
				}
			});
		}).catch(butIgnoreInteractionCollectorErrors);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
