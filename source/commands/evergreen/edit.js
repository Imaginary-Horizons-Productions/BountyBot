const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Sequelize } = require("sequelize");
const { timeConversion, textsHaveAutoModInfraction, trimForModalTitle } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");
const { findOrCreateCompany } = require("../../logic/companies");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const openBounties = await database.models.Bounty.findAll({ where: { userId: interaction.client.user.id, companyId: interaction.guildId, state: "open" } });
	if (openBounties.length < 1) {
		interaction.reply({ content: "This server doesn't seem to have any open evergreen bounties at the moment.", flags: [MessageFlags.Ephemeral] });
		return;
	}

	interaction.reply({
		content: "Editing an evergreen bounty will not change previous completions.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setPlaceholder("Select a bounty to edit...")
					.setMaxValues(1)
					.setOptions(bountiesToSelectOptions(openBounties))
			)
		],
		flags: [MessageFlags.Ephemeral],
		withResponse: true
	}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
		const [bountyId] = collectedInteraction.values;
		// Verify bounty exists
		const bounty = await database.models.Bounty.findByPk(bountyId);
		if (bounty?.state !== "open") {
			interaction.update({ content: `There is no evergreen bounty #${bounty.slotNumber}.`, components: [] });
			return;
		}

		collectedInteraction.showModal(
			new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`)
				.setTitle(trimForModalTitle(`Edit Bounty: ${bounty.title}`))
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
							.setPlaceholder("Bounties with clear instructions are easier to complete...")
							.setValue(bounty.description ?? "")
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("imageURL")
							.setLabel("Image URL")
							.setRequired(false)
							.setStyle(TextInputStyle.Short)
							.setValue(bounty.attachmentURL ?? "")
					)
				)
		);
		interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
			interaction.deleteReply();
			const title = modalSubmission.fields.getTextInputValue("title");
			const description = modalSubmission.fields.getTextInputValue("description");

			const errors = [];
			if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "evergreen edit")) {
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

			if (errors.length > 0) {
				modalSubmission.reply({ content: `The following errors were encountered while editing your bounty **${title}**:\n• ${errors.join("\n• ")}`, flags: [MessageFlags.Ephemeral] });
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
			bounty.editCount++;
			bounty.save();

			// update bounty board
			const [company] = await findOrCreateCompany(modalSubmission.guildId);
			if (company.bountyBoardId) {
				const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: modalSubmission.guildId, userId: modalSubmission.client.user.id, state: "open" }, include: database.models.Bounty.Company, order: [["slotNumber", "ASC"]] });
				const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.embed(modalSubmission.guild, company.level, false, company, [])));
				const bountyBoard = await modalSubmission.guild.channels.fetch(company.bountyBoardId);
				bountyBoard.threads.fetch(company.evergreenThreadId).then(async thread => {
					const message = await thread.fetchStarterMessage();
					message.edit({ embeds });
				});
			}

			const bountyEmbed = await bounty.embed(modalSubmission.guild, company.level, false, company, []);
			modalSubmission.reply({ content: "Here's the embed for the newly edited evergreen bounty:", embeds: [bountyEmbed], flags: [MessageFlags.Ephemeral] });
		});
	}).catch(error => {
		if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
			console.error(error);
		}
	})
};

module.exports = {
	data: {
		name: "edit",
		description: "Change the name, description, or image of an evergreen bounty"
	},
	executeSubcommand
};
