const { InteractionContextType, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags, userMention } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { textsHaveAutoModInfraction, generateTextBar } = require('../util/textUtil');
const { getRankUpdates } = require('../util/scoreUtil.js');
const { Toast } = require('../models/toasts/Toast.js');
const { Goal } = require('../models/companies/Goal.js');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "Raise a Toast";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive toast text, then raise the toast to the user */
	async (interaction, runMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot raise a toast to yourself.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		if (runMode === "production" && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot raist a toast to a bot.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guildId);
		const [sender] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.user.id, interaction.guildId);
		if (sender.isBanned) {
			interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const [toastee] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.targetId, interaction.guildId);
		if (toastee.isBanned) {
			interaction.reply({ content: `${userMention(interaction.targetId)} cannot receive toasts because they are banned from interacting with BountyBot on this server.`, flags: [MessageFlags.Ephemeral] });
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
		interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modalId, time: 300000 }).then(async modalSubmission => {
			const toastText = modalSubmission.fields.getTextInputValue("message");
			if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [toastText], "toast")) {
				modalSubmission.reply({ content: "Your toast was blocked by AutoMod.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			const season = await logicLayer.seasons.incrementSeasonStat(modalSubmission.guild.id, "toastsRaised");

			const { toastId, rewardedHunterIds, rewardTexts, critValue } = await logicLayer.toasts.raiseToast(modalSubmission.guild, company, modalSubmission.member, sender, [interaction.targetId], season.id, toastText);
			const embeds = [Toast.generateEmbed(company.toastThumbnailURL, toastText, [interaction.targetId], modalSubmission.member)];

			if (rewardedHunterIds.length > 0) {
				const goalUpdate = await logicLayer.goals.progressGoal(modalSubmission.guild.id, "toasts", sender, season);
				if (goalUpdate.gpContributed > 0) {
					rewardTexts.push(`This toast contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
					if (goalUpdate.goalCompleted) {
						embeds.push(Goal.generateCompletionEmbed(goalUpdate.contributorIds));
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
				components: [Toast.generateSecondingActionRow(toastId)],
				withResponse: true
			}).then(async response => {
				let content = "";
				if (rewardedHunterIds.length > 0) {
					const rankUpdates = await getRankUpdates(interaction.guild, logicLayer);
					content = Toast.generateRewardString(rewardedHunterIds, rankUpdates, rewardTexts, interaction.member.toString(), company.festivalMultiplierString(), critValue);
				}

				if (content) {
					if (modalSubmission.channel.isThread()) {
						modalSubmission.channel.send({ content, flags: MessageFlags.SuppressNotifications });
					} else {
						response.resource.message.startThread({ name: "Rewards" }).then(thread => {
							thread.send({ content, flags: MessageFlags.SuppressNotifications });
						})
					}
					company.updateScoreboard(modalSubmission.guild, logicLayer);
				}
			});
		})
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
