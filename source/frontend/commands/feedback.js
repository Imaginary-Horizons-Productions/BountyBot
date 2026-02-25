const { TextInputBuilder, ModalBuilder, TextInputStyle, PermissionFlagsBits, EmbedBuilder, InteractionContextType, MessageFlags, LabelBuilder, FileUploadBuilder, userMention } = require('discord.js');
const { EmbedLimits } = require('@sapphire/discord.js-utilities');
const { CommandWrapper } = require('../classes');
const { testGuildId, feedbackChannelId, SKIP_INTERACTION_HANDLING } = require('../../constants');
const { butIgnoreInteractionCollectorErrors } = require('../shared');
const { timeConversion } = require('../../shared');

const mainId = "feedback";
module.exports = new CommandWrapper(mainId, "Provide BountyBot feedback and get an invite to the test server", PermissionFlagsBits.SendMessages, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Open the modal associated with the feedback type to prompt more specific information */
	(interaction, origin, runMode) => {
		if (!testGuildId || !feedbackChannelId) {
			interaction.reply({ content: "The test server is not yet configured to receive feedback, thanks for your patience.", flags: MessageFlags.Ephemeral });
			return;
		}

		switch (interaction.options.getString("feedback-type")) {
			case "bug": {
				const titleId = "title";
				const stepsId = "steps";
				const actualId = "actual";
				const expectedId = "expected";
				const imageId = "image";
				const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setTitle("Bug Report")
					.addLabelComponents(
						new LabelBuilder().setLabel("Title")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(titleId)
									.setMaxLength(EmbedLimits.MaximumTitleLength - 12)
									.setStyle(TextInputStyle.Short)
							),
						new LabelBuilder().setLabel("Steps to reproduce")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(stepsId)
									.setStyle(TextInputStyle.Paragraph)
							),
						new LabelBuilder().setLabel("What happened")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(actualId)
									.setStyle(TextInputStyle.Short)
							),
						new LabelBuilder().setLabel("What I was expecting to happen")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(expectedId)
									.setStyle(TextInputStyle.Short)
							),
						new LabelBuilder().setLabel("Screenshot/Diagram")
							.setFileUploadComponent(
								new FileUploadBuilder().setCustomId(imageId)
									.setMaxValues(1)
									.setRequired(false)
							)
					);
				interaction.showModal(modal);
				interaction.awaitModalSubmit({ filter: (incoming) => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(modalSubmission => {
					const errors = [];
					const embed = new EmbedBuilder().setAuthor({ name: modalSubmission.user.username, iconURL: modalSubmission.user.avatarURL() })
						.setTitle(`Bug Report: ${modalSubmission.fields.getTextInputValue(titleId)}`)
						.addFields(
							{ name: "Reporter", value: userMention(modalSubmission.user.id) },
							{ name: "Steps to Reproduce", value: modalSubmission.fields.getTextInputValue(stepsId) },
							{ name: "Actual Behavior", value: modalSubmission.fields.getTextInputValue(actualId) },
							{ name: "Expected Behavior", value: modalSubmission.fields.getTextInputValue(expectedId) }
						);

					if (modalSubmission.user.hexAccentColor) {
						embed.setColor(modalSubmission.user.hexAccentColor);
					}

					const imageFileCollection = modalSubmission.fields.getUploadedFiles(imageId);
					if (imageFileCollection?.size > 0) {
						embed.setImage(imageFileCollection.first().url);
					}

					modalSubmission.client.guilds.fetch(testGuildId).then(testGuild => {
						return testGuild.channels.fetch(feedbackChannelId);
					}).then(feedbackChannel => {
						feedbackChannel.createInvite({ maxAge: 0 }).then(invite => {
							feedbackChannel.send({ embeds: [embed] });
							modalSubmission.reply({ content: `Your bug report has been recorded${errors.length > 0 ? `, but the following errors were encountered: ${errors.join(", ")}` : ""}.You can join the Imaginary Horizons Productions test server to provide additional information here: ${invite.url}`, flags: MessageFlags.Ephemeral })
						})
					})
				}).catch(butIgnoreInteractionCollectorErrors);
			} break;
			case "feature": {
				const titleId = "title";
				const userInputId = "user";
				const functionalityId = "functionality";
				const benefitId = "benefit";
				const imageId = "image";
				const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setTitle("Feature Request")
					.addLabelComponents(
						new LabelBuilder().setLabel("Title")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(titleId)
									.setMaxLength(EmbedLimits.MaximumTitleLength - 17)
									.setStyle(TextInputStyle.Short)
							),
						new LabelBuilder().setLabel("For who?")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(userInputId)
									.setPlaceholder("As a ___")
									.setStyle(TextInputStyle.Short)
							),
						new LabelBuilder().setLabel("What kind of feature?")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(functionalityId)
									.setPlaceholder("I'd like to ___")
									.setStyle(TextInputStyle.Paragraph)
							),
						new LabelBuilder().setLabel("Why?")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(benefitId)
									.setPlaceholder("So that I can ___")
									.setStyle(TextInputStyle.Short)
							),
						new LabelBuilder().setLabel("Diagram")
							.setFileUploadComponent(
								new FileUploadBuilder().setCustomId(imageId)
									.setMaxValues(1)
									.setRequired(false)
							)
					);
				interaction.showModal(modal);
				interaction.awaitModalSubmit({ filter: (incoming) => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(modalSubmission => {
					const errors = [];
					const embed = new EmbedBuilder().setAuthor({ name: modalSubmission.user.username, iconURL: modalSubmission.user.avatarURL() })
						.setTitle(`Feature Request: ${modalSubmission.fields.getTextInputValue(titleId)}`)
						.addFields(
							{ name: "Reporter", value: userMention(modalSubmission.user.id) },
							{ name: "User Demographic", value: modalSubmission.fields.getTextInputValue(userInputId) },
							{ name: "Functionality", value: modalSubmission.fields.getTextInputValue(functionalityId) },
							{ name: "Benefit", value: modalSubmission.fields.getTextInputValue(benefitId) }
						);

					if (modalSubmission.user.hexAccentColor) {
						embed.setColor(modalSubmission.user.hexAccentColor);
					}

					const imageFileCollection = modalSubmission.fields.getUploadedFiles(imageId);
					if (imageFileCollection?.size > 0) {
						embed.setImage(imageFileCollection.first().url);
					}

					modalSubmission.client.guilds.fetch(testGuildId).then(testGuild => {
						return testGuild.channels.fetch(feedbackChannelId);
					}).then(feedbackChannel => {
						feedbackChannel.createInvite({ maxAge: 0 }).then(invite => {
							feedbackChannel.send({ embeds: [embed] });
							modalSubmission.reply({ content: `Your feature request has been recorded${errors.length > 0 ? `, but the following errors were encountered: ${errors.join(", ")}` : ""}. You can join the Imaginary Horizons Productions test server to provide additional information here: ${invite.url}`, flags: MessageFlags.Ephemeral })
						})
					})
				}).catch(butIgnoreInteractionCollectorErrors);
				break;
			}
		}
	}
).setOptions(
	{
		type: "String",
		name: "feedback-type",
		description: "the type of feedback you'd like to provide",
		required: true,
		choices: [{ name: "bug report", value: "bug" }, { name: "feature request", value: "feature" }]
	}
);
