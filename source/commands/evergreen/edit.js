const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { Sequelize } = require("sequelize");
const { timeConversion, textsHaveAutoModInfraction, trimForModalTitle } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const openBounties = await database.models.Bounty.findAll({ where: { userId: interaction.client.user.id, companyId: interaction.guildId, state: "open" } });
	if (openBounties.length < 1) {
		interaction.reply({ content: "This server doesn't seem to have any open evergreen bounties at the moment.", ephemeral: true });
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
		ephemeral: true,
		fetchReply: true
	}).then(reply => {
		const collector = reply.createMessageComponentCollector({ max: 1 });
		collector.on("collect", async (collectedInteraction) => {
			const [bountyId] = collectedInteraction.values;
			// Verify bounty exists
			const bounty = await database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company });
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
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty **${title}**:\n• ${errors.join("\n• ")}`, ephemeral: true });
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
				bounty.increment("editCount");

				// update bounty board
				const bountyEmbed = await bounty.asEmbed(modalSubmission.guild, bounty.Company.level, bounty.Company.festivalMultiplierString(), false, database);
				const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: modalSubmission.guildId, userId: modalSubmission.client.user.id, state: "open" }, include: database.models.Bounty.Company, order: [["slotNumber", "ASC"]] });
				const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(modalSubmission.guild, bounty.Company.level, bounty.Company.festivalMultiplierString(), false, database)));
				if (bounty.Company.bountyBoardId) {
					const bountyBoard = await modalSubmission.guild.channels.fetch(bounty.Company.bountyBoardId);
					bountyBoard.threads.fetch(bounty.Company.evergreenThreadId).then(async thread => {
						const message = await thread.fetchStarterMessage();
						message.edit({ embeds });
					});
				}

				modalSubmission.reply({ content: "Here's the embed for the newly edited evergreen bounty:", embeds: [bountyEmbed], ephemeral: true });
			}).catch(console.error);
		})
	})
};

module.exports = {
	data: {
		name: "edit",
		description: "Change the name, description, or image of an evergreen bounty"
	},
	executeSubcommand
};
