const { GuildScheduledEventEntityType } = require('discord.js');
const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { YEAR_IN_MS } = require('../constants');
const { getRankUpdates, checkTextsInAutoMod } = require('../helpers');

const customId = "bountypostmodal";
module.exports = new InteractionWrapper(customId, 3000,
	/** Serialize data into a bounty, then announce with showcase embed */
	async (interaction, [slotNumber]) => {
		const title = interaction.fields.getTextInputValue("title");
		const description = interaction.fields.getTextInputValue("description");

		const isBlockedByAutoMod = await checkTextsInAutoMod(interaction.channel, interaction.member, [title, description], "bounty post");
		if (isBlockedByAutoMod) {
			interaction.reply({ content: "Your bounty could not be posted because it tripped AutoMod.", ephemeral: true });
			return;
		}

		const rawBounty = {
			userId: interaction.user.id,
			companyId: interaction.guildId,
			slotNumber: parseInt(slotNumber),
			isEvergreen: false,
			title,
			description
		};
		const errors = [];

		const imageURL = interaction.fields.getTextInputValue("imageURL");
		if (imageURL) {
			try {
				new URL(imageURL);
				rawBounty.attachmentURL = imageURL;
			} catch (error) {
				errors.push(error.message);
			}
		}

		const startTimestamp = parseInt(interaction.fields.getTextInputValue("startTimestamp"));
		const endTimestamp = parseInt(interaction.fields.getTextInputValue("endTimestamp"));
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
			interaction.message.edit({ components: [] });
			interaction.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${errors.join("\n• ")}`, ephemeral: true });
			return;
		}

		const poster = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
		poster.addXP(interaction.guild, 1, true).then(() => {
			getRankUpdates(interaction.guild);
		});

		if (shouldMakeEvent) {
			const eventPayload = {
				name: `Bounty: ${title}`,
				description,
				scheduledStartTime: startTimestamp * 1000,
				scheduledEndTime: endTimestamp * 1000,
				privacyLevel: 2,
				entityType: GuildScheduledEventEntityType.External,
				entityMetadata: { location: `${interaction.member.displayName}'s #${slotNumber} Bounty` }
			};
			if (imageURL) {
				eventPayload.image = imageURL;
			}
			const event = await interaction.guild.scheduledEvents.create(eventPayload);
			rawBounty.scheduledEventId = event.id;
		}

		const bounty = await database.models.Bounty.create(rawBounty);

		// post in bounty board forum
		const company = await database.models.Company.findByPk(interaction.guildId);
		const bountyEmbed = await bounty.asEmbed(interaction.guild, poster.level, company.eventMultiplierString());
		interaction.reply(company.sendAnnouncement({ content: `${interaction.member} has posted a new bounty:`, embeds: [bountyEmbed] })).then(() => {
			if (company.bountyBoardId) {
				interaction.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
					return bountyBoard.threads.create({
						name: bounty.title,
						message: { embeds: [bountyEmbed] }
					})
				}).then(posting => {
					bounty.postingId = posting.id;
					bounty.save()
				}).catch(error => {
					if (error.code == 10003) {
						interaction.followUp({ content: "Looks like your server doesn't have a bounty board channel. Make one with `/create-default bounty-board-forum`?", ephemeral: true });
					} else {
						throw error;
					}
				})
			}
		});
	}
);
