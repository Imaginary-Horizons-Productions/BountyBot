const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ComponentType, DiscordjsErrorCodes, unorderedList, bold, LabelBuilder } = require("discord.js");
const { ModalLimits } = require("@sapphire/discord.js-utilities");
const { SubcommandWrapper } = require("../../classes");
const { timeConversion } = require("../../../shared");
const { textsHaveAutoModInfraction, commandMention, bountiesToSelectOptions, buildBountyEmbed, truncateTextToLength, validateScheduledEventTimestamps, createBountyEventPayload } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("edit", "Edit the title, description, image, or time of one of your bounties",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: "You don't seem to have any open bounties at the moment.", flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: "You can select one of your open bounties to edit below.\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to edit...")
						.setMaxValues(1)
						.setOptions(bountiesToSelectOptions(openBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [bountyId] = collectedInteraction.values;
			// Verify bounty exists
			const bounty = await logicLayer.bounties.findBounty(bountyId);
			if (bounty?.state !== "open") {
				interaction.update({ content: `The selected bounty doesn't seem to be open.`, components: [] });
				return;
			}

			const eventStartComponent = new TextInputBuilder().setCustomId("startTimestamp")
				.setRequired(false)
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Required if making an event with the bounty");
			const eventEndComponent = new TextInputBuilder().setCustomId("endTimestamp")
				.setRequired(false)
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Required if making an event with the bounty");

			if (bounty.scheduledEventId) {
				const scheduledEvent = await interaction.guild.scheduledEvents.fetch(bounty.scheduledEventId);
				eventStartComponent.setValue((scheduledEvent.scheduledStartTimestamp / 1000).toString());
				eventEndComponent.setValue((scheduledEvent.scheduledEndTimestamp / 1000).toString());
			}
			collectedInteraction.showModal(
				new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`)
					.setTitle(truncateTextToLength(`Edit Bounty: ${bounty.title}`, ModalLimits.MaximumTitleCharacters))
					.addLabelComponents(
						new LabelBuilder().setLabel("Title")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId("title")
									.setRequired(false)
									.setStyle(TextInputStyle.Short)
									.setPlaceholder("Discord markdown allowed...")
									.setValue(bounty.title)
							),
						new LabelBuilder().setLabel("Description")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId("description")
									.setRequired(false)
									.setStyle(TextInputStyle.Paragraph)
									.setPlaceholder("Get a 1 XP bonus on completion for the following: description, image URL, timestamps")
									.setValue(bounty.description ?? "")
							),
						new LabelBuilder().setLabel("Image URL")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId("imageURL")
									.setRequired(false)
									.setStyle(TextInputStyle.Short)
									.setValue(bounty.attachmentURL ?? "")
							),
						new LabelBuilder().setLabel("Event Start (Unix Timestamp)")
							.setTextInputComponent(eventStartComponent),
						new LabelBuilder().setLabel("Event End (Unix Timestamp)")
							.setTextInputComponent(eventEndComponent)
					)
			);
			return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				const title = modalSubmission.fields.getTextInputValue("title");
				const description = modalSubmission.fields.getTextInputValue("description");

				const updatePayload = {};
				const errors = [];
				if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "edit bounty")) {
					errors.push("The bounty's new title or description would trip this server's AutoMod.");
				} else {
					updatePayload.title = title;
					updatePayload.description = description;
				}

				const imageURL = modalSubmission.fields.getTextInputValue("imageURL");
				if (imageURL) {
					try {
						new URL(imageURL);
						updatePayload.attachmentURL = imageURL;
					} catch (error) {
						errors.push(error.message);
					}
				} else {
					updatePayload.attachmentURL = null;
				}

				const startTimestamp = parseInt(modalSubmission.fields.getTextInputValue("startTimestamp"));
				const endTimestamp = parseInt(modalSubmission.fields.getTextInputValue("endTimestamp"));
				if (startTimestamp || endTimestamp) {
					errors.push(...validateScheduledEventTimestamps(startTimestamp, endTimestamp));
				}

				if (errors.length > 0) {
					interaction.deleteReply();
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty ${bold(title)}:\n${unorderedList(errors)}`, flags: MessageFlags.Ephemeral });
					return;
				}

				if (startTimestamp && endTimestamp) {
					const eventPayload = createBountyEventPayload(title, modalSubmission.member.displayName, bounty.slotNumber, description, updatePayload.attachmentURL, startTimestamp, endTimestamp);
					if (bounty.scheduledEventId) {
						modalSubmission.guild.scheduledEvents.edit(bounty.scheduledEventId, eventPayload);
					} else {
						const event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
						updatePayload.scheduledEventId = event.id;
					}
				} else if (bounty.scheduledEventId) {
					modalSubmission.guild.scheduledEvents.delete(bounty.scheduledEventId);
					updatePayload.scheduledEventId = null;
				}
				await bounty.increment("editCount");
				bounty.update(updatePayload);

				// update bounty board
				const bountyEmbed = await buildBountyEmbed(bounty, modalSubmission.guild, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, await logicLayer.bounties.getHunterIdSet(bountyId));
				if (origin.company.bountyBoardId) {
					interaction.guild.channels.fetch(origin.company.bountyBoardId).then(bountyBoard => {
						return bountyBoard.threads.fetch(bounty.postingId);
					}).then(async thread => {
						if (thread.archived) {
							await thread.setArchived(false, "Unarchived to update posting");
						}
						thread.edit({ name: bounty.title });
						thread.send({ content: "The bounty was edited.", flags: MessageFlags.SuppressNotifications });
						return thread.fetchStarterMessage();
					}).then(posting => {
						posting.edit({ embeds: [bountyEmbed] });
					})
				}

				modalSubmission.update({ content: `Bounty edited! You can use ${commandMention("bounty showcase")} to let other bounty hunters know about the changes.`, embeds: [bountyEmbed], components: [] });
			});
		}).catch(error => {
			if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		})
	}
);
