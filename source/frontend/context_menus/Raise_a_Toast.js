const { InteractionContextType, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags, userMention, DiscordjsErrorCodes } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { textsHaveAutoModInfraction, generateTextBar, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, generateToastEmbed, generateSecondingActionRow, generateToastRewardString, generateCompletionEmbed, sendToRewardsThread, formatHunterResultsToRewardTexts, reloadHunterMapSubset, buildCompanyLevelUpLine, syncRankRoles, formatSeasonResultsToRewardTexts } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "Raise a Toast";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive toast text, then raise the toast to the user */
	async (interaction, runMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot raise a toast to yourself.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (runMode === "production" && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot raist a toast to a bot.", flags: MessageFlags.Ephemeral });
			return;
		}

		const [toastee] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.targetId, interaction.guildId);
		if (toastee.isBanned) {
			interaction.reply({ content: `${userMention(interaction.targetId)} cannot receive toasts because they are banned from interacting with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const modalId = `${SKIP_INTERACTION_HANDLING}${interaction.id}`;
		interaction.showModal(new ModalBuilder().setCustomId(modalId)
			.setTitle("Raising a Toast")
			.addComponents(
				new ActionRowBuilder().addComponents(
					new TextInputBuilder().setCustomId("message")
						.setLabel("Toast Message")
						.setStyle(TextInputStyle.Short)
				)
			)
		);
		return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modalId, time: 300000 }).then(async modalSubmission => {
			const toastText = modalSubmission.fields.getTextInputValue("message");
			if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [toastText], "toast")) {
				modalSubmission.reply({ content: "Your toast was blocked by AutoMod.", flags: MessageFlags.Ephemeral });
				return;
			}

			const season = await logicLayer.seasons.incrementSeasonStat(modalSubmission.guild.id, "toastsRaised");
			let hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
			const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guildId);

			const previousCompanyLevel = company.getLevel(Object.values(hunterMap));
			const { toastId, rewardedHunterIds, hunterResults, critValue } = await logicLayer.toasts.raiseToast(modalSubmission.guild, company, interaction.user.id, new Set([interaction.targetId]), hunterMap, season.id, toastText, null);
			hunterMap = await reloadHunterMapSubset(hunterMap, rewardedHunterIds.concat(interaction.user.id));
			const rewardTexts = formatHunterResultsToRewardTexts(hunterResults, hunterMap, company);
			const companyLevelLine = buildCompanyLevelUpLine(company, previousCompanyLevel, Object.values(hunterMap), interaction.guild.name);
			if (companyLevelLine) {
				rewardTexts.push(companyLevelLine);
			}
			const embeds = [generateToastEmbed(company.toastThumbnailURL, toastText, new Set([interaction.targetId]), modalSubmission.member)];

			if (rewardedHunterIds.length > 0) {
				const goalUpdate = await logicLayer.goals.progressGoal(modalSubmission.guild.id, "toasts", hunterMap[interaction.user.id], season);
				if (goalUpdate.gpContributed > 0) {
					rewardTexts.push(`This toast contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
					if (goalUpdate.goalCompleted) {
						embeds.push(generateCompletionEmbed(goalUpdate.contributorIds));
					}
					const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
					if (goalId !== null) {
						embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
					} else {
						embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
					}
				}
			}

			modalSubmission.reply({
				embeds,
				components: [generateSecondingActionRow(toastId)],
				withResponse: true
			}).then(async response => {
				if (rewardedHunterIds.length > 0) {
					const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
					const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
					const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks);
					syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
					const rewardString = generateToastRewardString(rewardedHunterIds, formatSeasonResultsToRewardTexts(seasonUpdates, descendingRanks, await interaction.guild.roles.fetch()), rewardTexts, interaction.member.toString(), company.festivalMultiplierString(), critValue);
					sendToRewardsThread(response.resource.message, rewardString, "Rewards");
					const embeds = [];
					const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
					if (company.scoreboardIsSeasonal) {
						embeds.push(await seasonalScoreboardEmbed(company, modalSubmission.guild, participationMap, descendingRanks, goalProgress));
					} else {
						embeds.push(await overallScoreboardEmbed(company, modalSubmission.guild, await logicLayer.hunters.findCompanyHunters(modalSubmission.guild.id), goalProgress));
					}
					updateScoreboard(company, modalSubmission.guild, embeds);
				}
			});
		}).catch(error => {
			if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		})
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
