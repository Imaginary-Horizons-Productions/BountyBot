const { ModalBuilder, TextDisplayBuilder, LabelBuilder, ChannelSelectMenuBuilder, ChannelType, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { SelectOptionWrapper } = require("../../classes");
const { ensureBountyExistsAndInteractorIsPoster } = require("./_earlyOuts");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { timeConversion } = require("../../../shared");
const { butIgnoreInteractionCollectorErrors, bountyEmbed, unarchiveAndUnlockThread } = require("../../shared");

module.exports = new SelectOptionWrapper("showcase",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, theater, isDevMode, logicLayer, [bounty]) => {
			const nextShowcaseInMS = new Date(theater.hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
			if (!isDevMode && Date.now() < nextShowcaseInMS) {
				interaction.reply({ content: `You can showcase another bounty in ${discordTimestamp(Math.floor(nextShowcaseInMS / 1000), TimestampStyles.RelativeTime)}.`, flags: MessageFlags.Ephemeral });
				return;
			}

			const labelIdChannel = "channel";
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Showcase a Bounty")
				.addTextDisplayComponents(new TextDisplayBuilder().setContent("You can showcase 1 bounty per week. The showcased bounty's XP reward will be increased."))
				.addLabelComponents(
					new LabelBuilder().setLabel("Channel")
						.setChannelSelectMenuComponent(
							new ChannelSelectMenuBuilder().setCustomId(labelIdChannel)
								.setPlaceholder("Select a channel...")
								.setChannelTypes(ChannelType.GuildText)
						)
				);
			await interaction.showModal(modal);
			const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
				.catch(butIgnoreInteractionCollectorErrors);
			if (!modalSubmission) {
				return;
			}

			// Unnecessary Validations: "bounty existence", "posting thread existence"; if a bounty thread (or the bounty, which cascades the delete to the thread) is deleted while its modal is open, the modal does not submit
			const channel = modalSubmission.fields.getSelectedChannels(labelIdChannel).first();
			if (!channel.members.has(modalSubmission.client.user.id)) {
				modalSubmission.reply({ content: "BountyBot is not in the selected channel.", flags: MessageFlags.Ephemeral });
				return;
			}

			if (!channel.permissionsFor(modalSubmission.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
				modalSubmission.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: MessageFlags.Ephemeral });
				return;
			}

			await bounty.reload();
			if (bounty.state !== "open") {
				modalSubmission.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
				return;
			}

			bounty = await bounty.increment("showcaseCount");
			await theater.hunter.update({ lastShowcaseTimestamp: new Date() });
			const currentPosterLevel = theater.hunter.getLevel(theater.company.xpCoefficient);
			const embeds = [bountyEmbed(bounty, modalSubmission.member, currentPosterLevel, false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))];

			channel.send({ content: `${modalSubmission.member} increased the reward on their bounty!`, embeds });

			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				modalSubmission.message.edit({ embeds });
				await unarchiveAndUnlockThread(modalSubmission.channel, "bounty showcased by poster");
			}
			if (modalSubmission.channel.sendable) {
				modalSubmission.reply({ content: `${modalSubmission.member} increased the reward on this bounty!` });
			}
		}
	)
);
