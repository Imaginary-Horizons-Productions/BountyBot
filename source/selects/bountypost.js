const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, GuildScheduledEventEntityType } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { YEAR_IN_MS, MAX_EMBED_TITLE_LENGTH } = require('../constants');
const { database } = require('../../database');
const { timeConversion, checkTextsInAutoMod } = require('../util/textUtil');
const { getRankUpdates } = require('../util/scoreUtil');

const mainId = "bountypost";
module.exports = new SelectWrapper(mainId, 3000,
	/** Recieve remaining bounty configurations from the user */
	(interaction, args) => {
		const [slotNumber] = interaction.values;
		interaction.showModal(
			new ModalBuilder().setCustomId(mainId)
				.setTitle(`New Bounty (Slot ${slotNumber})`)
				.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("title")
							.setLabel("Title")
							.setStyle(TextInputStyle.Short)
							.setPlaceholder("Discord markdown allowed...")
							.setMaxLength(MAX_EMBED_TITLE_LENGTH)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("description")
							.setLabel("Description")
							.setStyle(TextInputStyle.Paragraph)
							.setPlaceholder("Bounties with clear instructions are easier to complete...")
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("imageURL")
							.setLabel("Image URL")
							.setRequired(false)
							.setStyle(TextInputStyle.Short)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("startTimestamp")
							.setLabel("Event Start (Unix Timestamp)")
							.setRequired(false)
							.setStyle(TextInputStyle.Short)
							.setPlaceholder("Required if making an event with the bounty")
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("endTimestamp")
							.setLabel("Event End (Unix Timestamp)")
							.setRequired(false)
							.setStyle(TextInputStyle.Short)
							.setPlaceholder("Required if making an event with the bounty")
					)
				)
		);

		interaction.awaitModalSubmit({ filter: (interaction) => interaction.customId === mainId, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
			const title = modalSubmission.fields.getTextInputValue("title");
			const description = modalSubmission.fields.getTextInputValue("description");

			const isBlockedByAutoMod = await checkTextsInAutoMod(modalSubmission.channel, modalSubmission.member, [title, description], "bounty post");
			if (isBlockedByAutoMod) {
				modalSubmission.reply({ content: "Your bounty could not be posted because it tripped AutoMod.", ephemeral: true });
				return;
			}

			const rawBounty = {
				userId: modalSubmission.user.id,
				companyId: modalSubmission.guildId,
				slotNumber: parseInt(slotNumber),
				isEvergreen: false,
				title,
				description
			};
			const errors = [];

			const imageURL = modalSubmission.fields.getTextInputValue("imageURL");
			if (imageURL) {
				try {
					new URL(imageURL);
					rawBounty.attachmentURL = imageURL;
				} catch (error) {
					errors.push(error.message);
				}
			}

			const startTimestamp = parseInt(modalSubmission.fields.getTextInputValue("startTimestamp"));
			const endTimestamp = parseInt(modalSubmission.fields.getTextInputValue("endTimestamp"));
			const shouldMakeEvent = startTimestamp && endTimestamp;
			if (startTimestamp || endTimestamp) {
				if (!shouldMakeEvent) {
					errors.push("Cannot make event with only start or only end timestamp.")
				}
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
				modalSubmission.message.edit({ components: [] });
				modalSubmission.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${errors.join("\n• ")}`, ephemeral: true });
				return;
			}

			const poster = await database.models.Hunter.findOne({ where: { userId: modalSubmission.user.id, companyId: modalSubmission.guildId } });
			poster.addXP(modalSubmission.guild.name, 1, true).then(() => {
				getRankUpdates(modalSubmission.guild);
			});

			if (shouldMakeEvent) {
				const eventPayload = {
					name: `Bounty: ${title}`,
					description,
					scheduledStartTime: startTimestamp * 1000,
					scheduledEndTime: endTimestamp * 1000,
					privacyLevel: 2,
					entityType: GuildScheduledEventEntityType.External,
					entityMetadata: { location: `${modalSubmission.member.displayName}'s #${slotNumber} Bounty` }
				};
				if (imageURL) {
					eventPayload.image = imageURL;
				}
				const event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
				rawBounty.scheduledEventId = event.id;
			}

			const bounty = await database.models.Bounty.create(rawBounty);

			// post in bounty board forum
			const company = await database.models.Company.findByPk(modalSubmission.guildId);
			const bountyEmbed = await bounty.asEmbed(modalSubmission.guild, poster.level, company.eventMultiplierString());
			modalSubmission.reply(company.sendAnnouncement({ content: `${modalSubmission.member} has posted a new bounty:`, embeds: [bountyEmbed] })).then(() => {
				if (company.bountyBoardId) {
					modalSubmission.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
						return bountyBoard.threads.create({
							name: bounty.title,
							message: { embeds: [bountyEmbed] }
						})
					}).then(posting => {
						bounty.postingId = posting.id;
						bounty.save()
					});
				} else {
					interaction.followUp({ content: "Looks like your server doesn't have a bounty board channel. Make one with `/create-default bounty-board-forum`?", ephemeral: true });
				}
			});
		}).catch(console.error);
	}
);
