const { InteractionContextType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, userMention, LabelBuilder } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { textsHaveAutoModInfraction, toastEmbed, secondingButtonRow, goalCompletionEmbed, sendRewardMessage, reloadHunterMapSubset, syncRankRoles, butIgnoreInteractionCollectorErrors, rewardSummary, consolidateHunterReceipts, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall } = require('../shared');
const { Company } = require('../../database/models');
const { timeConversion } = require('../../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "Raise a Toast";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive toast text, then raise the toast to the user */
	async (interaction, origin, runMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot raise a toast to yourself.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (runMode === "production" && interaction.targetUser.bot) {
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
			const companyReceipt = { guildName: interaction.guild.name };

			const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
			const { toastId, hunterReceipts } = await logicLayer.toasts.raiseToast(modalSubmission.guild, origin.company, interaction.user.id, new Set([interaction.targetId]), hunterMap, season.id, toastText, null);
			hunterMap = await reloadHunterMapSubset(hunterMap, Array.from(hunterReceipts.keys()));
			const currentCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
			if (previousCompanyLevel < currentCompanyLevel) {
				companyReceipt.levelUp = currentCompanyLevel;
			}

			const embeds = [];
			const goalProgress = {
				goalCompleted: false,
				currentGP: 0,
				requiredGP: 0
			};
			if (hunterReceipts.size > 0) {
				const goalUpdate = await logicLayer.goals.progressGoal(modalSubmission.guild.id, "toasts", hunterMap[interaction.user.id], season);
				goalProgress.goalCompleted = goalUpdate.goalCompleted;
				goalProgress.currentGP = goalUpdate.currentGP;
				goalProgress.requiredGP = goalUpdate.requiredGP;
				if (goalUpdate.gpContributed > 0) {
					companyReceipt.gp = goalUpdate.gpContributed;
					if (goalUpdate.goalCompleted) {
						embeds.push(goalCompletionEmbed(goalUpdate.contributorIds));
					}
				}
			}
			embeds.unshift(toastEmbed(origin.company.toastThumbnailURL, toastText, new Set([interaction.targetId]), modalSubmission.member, goalProgress));

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
					const rewardString = rewardSummary("toast", companyReceipt, hunterReceipts, origin.company.maxSimBounties);
					sendRewardMessage(response.resource.message, rewardString, "Rewards");
					if (origin.company.scoreboardIsSeasonal) {
						refreshReferenceChannelScoreboardSeasonal(origin.company, modalSubmission.guild, participationMap, descendingRanks, goalProgress);
					} else {
						refreshReferenceChannelScoreboardOverall(origin.company, modalSubmission.guild, hunterMap, goalProgress);
					}
				}
			});
		}).catch(butIgnoreInteractionCollectorErrors);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
