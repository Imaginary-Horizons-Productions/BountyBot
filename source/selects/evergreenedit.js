const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { timeConversion, checkTextsInAutoMod } = require('../util/textUtil');

const mainId = "evergreenedit";
module.exports = new SelectWrapper(mainId, 3000,
	/** Recieve bounty reconfigurations from the user */
	async (interaction, args, database) => {
		const [slotNumber] = interaction.values;
		// Verify bounty exists
		const existingBounty = await database.models.Bounty.findOne({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open", slotNumber } });
		if (!existingBounty) {
			interaction.update({ content: `There is no evergreen bounty #${slotNumber}.`, components: [] });
			return;
		}

		database.models.Bounty.findOne({ where: { userId: interaction.client.user.id, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
			interaction.showModal(
				new ModalBuilder().setCustomId(mainId)
					.setTitle(`Editing Bounty (${bounty.title})`)
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
			interaction.awaitModalSubmit({ filter: interaction => interaction.customId === mainId, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
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

				const bounty = await database.models.Bounty.findOne({ where: { userId: modalSubmission.client.user.id, companyId: modalSubmission.guildId, slotNumber, state: "open" } });
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
				const company = await database.models.Company.findByPk(modalSubmission.guildId);
				const bountyEmbed = await bounty.asEmbed(modalSubmission.guild, company.level, company.festivalMultiplierString(), database);
				const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: modalSubmission.guildId, userId: modalSubmission.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
				const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(modalSubmission.guild, company.level, company.festivalMultiplierString(), database)));
				if (company.bountyBoardId) {
					const bountyBoard = await modalSubmission.guild.channels.fetch(company.bountyBoardId);
					bountyBoard.threads.fetch(company.evergreenThreadId).then(async thread => {
						const message = await thread.fetchStarterMessage();
						message.edit({ embeds });
					});
				}

				modalSubmission.update({ content: "Bounty edited!", components: [] });
				modalSubmission.channel.send(company.sendAnnouncement({ content: `${modalSubmission.member} has edited an evergreen bounty:`, embeds: [bountyEmbed] }));
			}).catch(console.error);
		})
	}
);
