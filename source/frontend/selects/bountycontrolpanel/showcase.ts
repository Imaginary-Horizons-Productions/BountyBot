import { ChannelSelectMenuBuilder, ChannelType, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, TextDisplayBuilder, TimestampStyles } from "discord.js";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants.ts";
import { discordTimestamp, timeConversion } from "../../../shared/index.ts";
import { BountyState } from "../../../shared/types.ts";
import { SelectOptionFunctionality } from "../../classes/index.ts";
import { bountyEmbed, butIgnoreInteractionCollectorErrors, unarchiveAndUnlockThread } from "../../shared/index.ts";
import { ensureBountyExistsAndInteractorIsPoster } from "./_earlyOuts.ts";

export default new SelectOptionFunctionality("showcase",
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
			if (bounty.state !== BountyState.Open) {
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
