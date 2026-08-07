import { channelMention, FileUploadBuilder, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder } from "discord.js";
import { LogicLayer } from "../../logic";
import { timeConversion } from "../../shared";
import { SKIP_INTERACTION_HANDLING } from "../../shared/constants";
import { BountyState } from "../../shared/types";
import { ItemTemplate, ItemTemplateSet } from "../classes";
import { bountyEmbed, commandMention, getBountyBoardThread, isInteractionCollectorError, selectOptionsFromBounties, unarchiveAndUnlockThread } from "../shared";

let logicLayer: LogicLayer;

const itemName = "Bounty Thumbnail";
export default new ItemTemplateSet(
	new ItemTemplate(itemName, "Adds an image to one of your open bounties!", 3000,
		async (interaction, theater) => {
			const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
			if (openBounties.length < 1) {
				interaction.reply({ content: "You don't have any open bounties on this server to add a thumbnail to.", flags: MessageFlags.Ephemeral });
				return 0;
			}

			const labelIdBountyId = "bounty-id";
			const labelIdImage = "image";
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Add Bounty Thumbnail")
				.addLabelComponents(
					new LabelBuilder().setLabel("Bounty")
						.setStringSelectMenuComponent(
							new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
								.setPlaceholder("Select a bounty...")
								.setOptions(selectOptionsFromBounties(openBounties))
						),
					new LabelBuilder().setLabel("Image")
						.setFileUploadComponent(
							new FileUploadBuilder().setCustomId(labelIdImage)
						)
				);
			interaction.showModal(modal);

			return interaction.awaitModalSubmit({ filter: (incoming) => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				const bounty = await logicLayer.bounties.findBounty(modalSubmission.fields.getStringSelectValues(labelIdBountyId)[0]);
				if (!bounty || bounty.state !== BountyState.Open) {
					modalSubmission.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
					return 0;
				}

				const imageFileCollection = modalSubmission.fields.getUploadedFiles(labelIdImage, true);
				const firstAttachment = imageFileCollection.first();
				if (!firstAttachment) {
					modalSubmission.reply({ content: "There was an error handling the submitted image.", flags: MessageFlags.Ephemeral });
					return 0;
				}

				await bounty.update({ thumbnailURL: firstAttachment.url });
				modalSubmission.reply({ content: `The thumbnail on ${bounty.title} has been updated.${bounty.postingId !== null ? ` ${channelMention(bounty.postingId)}` : ""}`, flags: MessageFlags.Ephemeral });

				const bountyThread = await getBountyBoardThread(modalSubmission.guild, theater.company.bountyBoardId, bounty.postingId);
				if (bountyThread) {
					if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
						(await bountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, theater.hunter.getLevel(theater.company.xpCoefficient), false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(interaction.guild.scheduledEvents))] });
						await unarchiveAndUnlockThread(bountyThread, "Bounty Thumbnail item used");
					}
					if (bountyThread.sendable) {
						bountyThread.send({ content: `This bounty's poster used ${commandMention("item")} to add a thumbnail to this bounty.`, flags: MessageFlags.SuppressNotifications });
					}
				}
				return 1;
			}).catch(error => {
				if (!isInteractionCollectorError(error)) {
					console.error(error);
				}
				return 0;
			});
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
