const { InteractionContextType, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require('../constants');
const { raiseToast } = require('../logic/toasts.js');
const { textsHaveAutoModInfraction } = require('../util/textUtil');
const { updateScoreboard } = require('../util/embedUtil.js');
const { findOrCreateCompany } = require('../logic/companies.js');
const { findOrCreateBountyHunter } = require('../logic/hunters.js');

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

			const { embeds, toastId, rewardText } = await raiseToast(modalSubmission.guild, company, modalSubmission.member, sender, [interaction.targetId], toastText);
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
			}).then(response => {
				if (rewardText) {
					if (modalSubmission.channel.isThread()) {
						modalSubmission.channel.send({ content: rewardText, flags: MessageFlags.SuppressNotifications });
					} else {
						response.resource.message.startThread({ name: "Rewards" }).then(thread => {
							thread.send({ content: rewardText, flags: MessageFlags.SuppressNotifications });
						})
					}
					updateScoreboard(company, modalSubmission.guild, database);
				}
			});
		})
	}
);
