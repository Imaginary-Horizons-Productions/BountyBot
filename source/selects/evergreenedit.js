const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { timeConversion, checkTextsInAutoMod, trimForModalTitle } = require('../util/textUtil');
const { SKIP_INTERACTION_HANDLING } = require('../constants');

const mainId = "evergreenedit";
module.exports = new SelectWrapper(mainId, 3000,
	/** Recieve bounty reconfigurations from the user */
	async (interaction, args, database) => {
		const [bountyId] = interaction.values;
		// Verify bounty exists
		const bounty = await database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company });
		if (bounty?.state !== "open") {
			interaction.update({ content: `There is no evergreen bounty #${bounty.slotNumber}.`, components: [] });
			return;
		}

		interaction.showModal(
			new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
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
							.setValue(bounty.description)
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
		interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${interaction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
			const title = modalSubmission.fields.getTextInputValue("title");
			const description = modalSubmission.fields.getTextInputValue("description");

			const isBlockedByAutoMod = await checkTextsInAutoMod(modalSubmission.channel, modalSubmission.member, [title, description], "evergreen edit");
			if (isBlockedByAutoMod) {
				modalSubmission.reply({ content: "Your edit could not be completed because it tripped AutoMod.", ephemeral: true });
				return;
			}

			const imageURL = modalSubmission.fields.getTextInputValue("imageURL");
			if (imageURL) {
				try {
					new URL(imageURL);
				} catch (error) {
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty **${title}**:\n• ${error.message}`, ephemeral: true });
				}
			}

			if (title) {
				bounty.title = title;
			}
			if (description) {
				bounty.description = description;
			}
			if (imageURL) {
				bounty.attachmentURL = imageURL;
			} else if (bounty.attachmentURL) {
				bounty.attachmentURL = null;
			}

			bounty.editCount++;
			bounty.save();

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

			modalSubmission.update({ content: "Bounty edited!", components: [] });
			modalSubmission.channel.send(bounty.Company.sendAnnouncement({ content: `${modalSubmission.member} has edited an evergreen bounty:`, embeds: [bountyEmbed] }));
		}).catch(console.error);
	}
);
