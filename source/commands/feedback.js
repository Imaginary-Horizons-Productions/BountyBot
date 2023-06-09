const { ModalBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { ActionRowBuilder, TextInputBuilder } = require('@discordjs/builders');
const { MAX_EMBED_TITLE_LENGTH } = require('../constants');

const customId = "feedback";
const options = [
	{
		type: "String",
		name: "feedback-type",
		description: "the type of feedback you'd like to provide",
		required: true,
		choices: [{ name: "bug report", value: "bug" }, { name: "feature request", value: "feature" }]
	}
];
const subcommands = [];
module.exports = new CommandWrapper(customId, "Provide feedback on this bot to the developers", PermissionFlagsBits.SendMessages, false, true, 3000, options, subcommands,
	/** Open the modal associated with the feedback type to prompt more specific information */
	(interaction) => {
		const feedbackType = interaction.options.getString("feedback-type");
		let modal = new ModalBuilder();
		switch (feedbackType) {
			case "bug":
				modal.setCustomId("bugreport")
					.setTitle("Bug Report")
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("title")
								.setLabel("Title")
								.setMaxLength(MAX_EMBED_TITLE_LENGTH - 12)
								.setStyle(TextInputStyle.Short)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("steps")
								.setLabel("Steps to reproduce")
								.setStyle(TextInputStyle.Paragraph)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("actual")
								.setLabel("What happened")
								.setStyle(TextInputStyle.Short)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("expected")
								.setLabel("What I was expecting to happen")
								.setStyle(TextInputStyle.Short)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("image")
								.setLabel("Screenshot/diagram URL")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
						)
					);
				break;
			case "feature":
				modal.setCustomId("featurerequest")
					.setTitle("Feature Request")
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("title")
								.setLabel("Title")
								.setMaxLength(MAX_EMBED_TITLE_LENGTH - 17)
								.setStyle(TextInputStyle.Short)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("user")
								.setLabel("For who?")
								.setPlaceholder("As a ___")
								.setStyle(TextInputStyle.Short)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("functionality")
								.setLabel("What kind of feature?")
								.setPlaceholder("I'd like to ___")
								.setStyle(TextInputStyle.Paragraph)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("benefit")
								.setLabel("Why?")
								.setPlaceholder("So that I can ___")
								.setStyle(TextInputStyle.Short)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("image")
								.setLabel("Diagram URL")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
						)
					);
				break;
		}
		interaction.showModal(modal);
	}
);
