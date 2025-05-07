const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, GuildScheduledEventEntityType, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { ModalLimits } = require("@sapphire/discord.js-utilities");
const { SubcommandWrapper } = require("../../classes");
const { timeConversion } = require("../../../shared");
const { textsHaveAutoModInfraction, commandMention, bountiesToSelectOptions, buildBountyEmbed, generateBountyBoardButtons, truncateTextToLength } = require("../../shared");
const { SKIP_INTERACTION_HANDLING, YEAR_IN_MS } = require("../../../constants");

module.exports = new SubcommandWrapper("edit", "Edit the title, description, image, or time of one of your bounties",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, poster]) {
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
				.setLabel("Event Start (Unix Timestamp)")
				.setRequired(false)
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Required if making an event with the bounty");
			const eventEndComponent = new TextInputBuilder().setCustomId("endTimestamp")
				.setLabel("Event End (Unix Timestamp)")
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
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("title")
								.setLabel("Title")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Discord markdown allowed...")
								.setValue(bounty.title)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("description")
								.setLabel("Description")
								.setRequired(false)
								.setStyle(TextInputStyle.Paragraph)
								.setPlaceholder("Get a 1 XP bonus on completion for the following: description, image URL, timestamps")
								.setValue(bounty.description ?? "")
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("imageURL")
								.setLabel("Image URL")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setValue(bounty.attachmentURL ?? "")
						),
						new ActionRowBuilder().addComponents(
							eventStartComponent
						),
						new ActionRowBuilder().addComponents(
							eventEndComponent
						)
					)
			);
			return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				const title = modalSubmission.fields.getTextInputValue("title");
				const description = modalSubmission.fields.getTextInputValue("description");

				const errors = [];
				if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "edit bounty")) {
					errors.push("The bounty's new title or description would trip this server's AutoMod.");
				}

				const imageURL = modalSubmission.fields.getTextInputValue("imageURL");
				if (imageURL) {
					try {
						new URL(imageURL);
					} catch (error) {
						errors.push(error.message);
					}
				}

				const startTimestamp = parseInt(modalSubmission.fields.getTextInputValue("startTimestamp"));
				const endTimestamp = parseInt(modalSubmission.fields.getTextInputValue("endTimestamp"));
				const shouldMakeEvent = startTimestamp && endTimestamp;
				if (startTimestamp || endTimestamp) {
					if (!startTimestamp) {
						errors.push("Start timestamp must be an integer.");
					} else if (!endTimestamp) {
						errors.push("End timestamp must be an integer.");
					} else {
						if (startTimestamp > endTimestamp) {
							errors.push("End timestamp was before start timestamp.");
						}

						const nowTimestamp = Date.now() / 1000;
						if (nowTimestamp >= startTimestamp) {
							errors.push("Start timestamp must be in the future.");
						}

						if (nowTimestamp >= endTimestamp) {
							errors.push("End timestamp must be in the future.");
						}

						if (startTimestamp >= nowTimestamp + (5 * YEAR_IN_MS)) {
							errors.push("Start timestamp cannot be 5 years in the future or further.");
						}

						if (endTimestamp >= nowTimestamp + (5 * YEAR_IN_MS)) {
							errors.push("End timestamp cannot be 5 years in the future or further.");
						}
					}
				}

				if (errors.length > 0) {
					interaction.deleteReply();
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty **${title}**:\n• ${errors.join("\n• ")}`, flags: MessageFlags.Ephemeral });
					return;
				}

				if (title) {
					bounty.title = title;
				}
				bounty.description = description;
				if (imageURL) {
					bounty.attachmentURL = imageURL;
				} else if (bounty.attachmentURL) {
					bounty.attachmentURL = null;
				}


				if (shouldMakeEvent) {
					const eventPayload = {
						name: `Bounty: ${title}`,
						scheduledStartTime: startTimestamp * 1000,
						scheduledEndTime: endTimestamp * 1000,
						privacyLevel: 2,
						entityType: GuildScheduledEventEntityType.External,
						entityMetadata: { location: `${modalSubmission.member.displayName}'s #${bounty.slotNumber} Bounty` }
					};
					if (description) {
						eventPayload.description = description;
					}
					if (imageURL) {
						eventPayload.image = imageURL;
					}
					if (bounty.scheduledEventId) {
						modalSubmission.guild.scheduledEvents.edit(bounty.scheduledEventId, eventPayload);
					} else {
						const event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
						bounty.scheduledEventId = event.id;
					}
				} else if (bounty.scheduledEventId) {
					modalSubmission.guild.scheduledEvents.delete(bounty.scheduledEventId);
					bounty.scheduledEventId = null;
				}
				bounty.editCount++;
				bounty.save();

				// update bounty board
				const [company] = await logicLayer.companies.findOrCreateCompany(modalSubmission.guildId);
				const bountyEmbed = await buildBountyEmbed(bounty, modalSubmission.guild, poster.getLevel(company.xpCoefficient), false, company, await logicLayer.bounties.findBountyCompletions(bountyId));
				if (company.bountyBoardId) {
					interaction.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
						return bountyBoard.threads.fetch(bounty.postingId);
					}).then(async thread => {
						if (thread.archived) {
							await thread.setArchived(false, "Unarchived to update posting");
						}
						thread.edit({ name: bounty.title });
						thread.send({ content: "The bounty was edited.", flags: MessageFlags.SuppressNotifications });
						return thread.fetchStarterMessage();
					}).then(posting => {
						posting.edit({
							embeds: [bountyEmbed],
							components: generateBountyBoardButtons(bounty)
						});
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
