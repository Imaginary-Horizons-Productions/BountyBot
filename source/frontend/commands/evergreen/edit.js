const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { ModalLimits } = require("@sapphire/discord.js-utilities");
const { SubcommandWrapper } = require("../../classes");
const { timeConversion } = require("../../../shared");
const { textsHaveAutoModInfraction, bountiesToSelectOptions, buildBountyEmbed, truncateTextToLength } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("edit", "Change the name, description, or image of an evergreen bounty",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const openBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: "This server doesn't seem to have any open evergreen bounties at the moment.", flags: MessageFlags.Ephemeral });
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
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [bountyId] = collectedInteraction.values;
			// Verify bounty exists
			const selectedBounty = openBounties.find(bounty => bounty.id === bountyId);
			if (selectedBounty?.state !== "open") {
				interaction.update({ content: `There is no evergreen bounty #${bountyId}.`, components: [] });
				return;
			}

			collectedInteraction.showModal(
				new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`)
					.setTitle(truncateTextToLength(`Edit Bounty: ${selectedBounty.title}`, ModalLimits.MaximumTitleCharacters))
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("title")
								.setLabel("Title")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Discord markdown allowed...")
								.setValue(selectedBounty.title)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("description")
								.setLabel("Description")
								.setRequired(false)
								.setStyle(TextInputStyle.Paragraph)
								.setPlaceholder("Bounties with clear instructions are easier to complete...")
								.setValue(selectedBounty.description ?? "")
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("imageURL")
								.setLabel("Image URL")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setValue(selectedBounty.attachmentURL ?? "")
						)
					)
			);
			return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
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
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty **${title}**:\n• ${errors.join("\n• ")}`, flags: MessageFlags.Ephemeral });
					return;
				}

				if (title) {
					selectedBounty.title = title;
				}
				selectedBounty.description = description;
				if (imageURL) {
					selectedBounty.attachmentURL = imageURL;
				} else if (selectedBounty.attachmentURL) {
					selectedBounty.attachmentURL = null;
				}
				selectedBounty.editCount++;
				selectedBounty.save();

				// update bounty board
				const [company] = await logicLayer.companies.findOrCreateCompany(modalSubmission.guildId);
				const allHunters = await logicLayer.hunters.findCompanyHunters(modalSubmission.guild.id);
				const currentCompanyLevel = company.getLevel(allHunters);
				if (company.bountyBoardId) {
					const embeds = await Promise.all(openBounties.map(bounty => buildBountyEmbed(bounty, modalSubmission.guild, currentCompanyLevel, false, company, new Set())));
					const bountyBoard = await modalSubmission.guild.channels.fetch(company.bountyBoardId);
					bountyBoard.threads.fetch(company.evergreenThreadId).then(async thread => {
						const message = await thread.fetchStarterMessage();
						message.edit({ embeds });
					});
				}

				const bountyEmbed = await buildBountyEmbed(selectedBounty, modalSubmission.guild, currentCompanyLevel, false, company, new Set());
				modalSubmission.reply({ content: "Here's the embed for the newly edited evergreen bounty:", embeds: [bountyEmbed], flags: MessageFlags.Ephemeral });
			});
		}).catch(error => {
			if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		})
	}
);
