const { InteractionContextType, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ButtonBuilder, ButtonStyle, EmbedBuilder, userMention } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require('../constants');
const { raiseToast } = require('../logic/toasts.js');
const { textsHaveAutoModInfraction, congratulationBuilder, listifyEN, generateTextBar } = require('../util/textUtil');
const { updateScoreboard } = require('../util/embedUtil.js');
const { findOrCreateCompany } = require('../logic/companies.js');
const { findOrCreateBountyHunter } = require('../logic/hunters.js');
const { getRankUpdates } = require('../util/scoreUtil.js');
const { Toast } = require('../models/toasts/Toast.js');
const { progressGoal, findLatestGoalProgress } = require('../logic/goals.js');

const mainId = "Raise a Toast";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive toast text, then raise the toast to the user */
	async (interaction, database, runMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot raise a toast to yourself.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		if (runMode === "prod" && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot raist a toast to a bot.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const [company] = await findOrCreateCompany(interaction.guildId);
		const [sender] = await findOrCreateBountyHunter(interaction.user.id, interaction.guildId);
		if (sender.isBanned) {
			interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const [toastee] = await findOrCreateBountyHunter(interaction.targetId, interaction.guildId);
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

			const { toastId, rewardedHunterIds, rewardTexts, critValue } = await raiseToast(modalSubmission.guild, company, modalSubmission.member, sender, [interaction.targetId], toastText);
			const embeds = [
				new EmbedBuilder().setColor("e5b271")
					.setThumbnail(company.toastThumbnailURL ?? 'https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png')
					.setTitle(toastText)
					.setDescription(`A toast to ${userMention(interaction.targetId)}!`)
					.setFooter({ text: modalSubmission.member.displayName, iconURL: modalSubmission.user.avatarURL() })
			];

			if (rewardedHunterIds.length > 0) {
				const goalUpdate = await progressGoal(modalSubmission.guild.id, "toasts", modalSubmission.user.id);
				if (goalUpdate.gpContributed > 0) {
					rewardTexts.push(`This toast contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
					if (goalUpdate.goalCompleted) {
						embeds.push(new EmbedBuilder().setColor("e5b271")
							.setTitle("Server Goal Completed")
							.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
							.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
							.addFields({ name: "Contributors", value: listifyEN(goalUpdate.contributorIds.map(id => userMention(id))) })
						);
					}
					const { goalId, currentGP, requiredGP } = await findLatestGoalProgress(interaction.guild.id);
					if (goalId !== null) {
						embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${Math.min(currentGP, requiredGP)}/${requiredGP} GP` });
					} else {
						embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
					}
				}
			}

			modalSubmission.reply({
				embeds,
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId(`secondtoast${SAFE_DELIMITER}${toastId}`)
							.setLabel("Hear, hear!")
							.setEmoji("🥂")
							.setStyle(ButtonStyle.Primary)
					)
				],
				withResponse: true
			}).then(async response => {
				let content = "";
				if (rewardedHunterIds.length > 0) {
					const rankUpdates = await getRankUpdates(interaction.guild, database);
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
					updateScoreboard(company, modalSubmission.guild, database);
				}
			});
		})
	}
);
