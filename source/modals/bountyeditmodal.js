const { GuildScheduledEventEntityType } = require('discord.js');
const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { YEAR_IN_MS } = require('../constants');

const customId = "bountyeditmodal";
module.exports = new InteractionWrapper(customId, 3000,
	/** Serialize data into a bounty, then announce with showcase embed */
	async (interaction, [slotNumber]) => {
		const title = interaction.fields.getTextInputValue("title");
		const description = interaction.fields.getTextInputValue("description");
		const imageURL = interaction.fields.getTextInputValue("imageURL");
		const startTimestamp = parseInt(interaction.fields.getTextInputValue("startTimestamp"));
		const endTimestamp = parseInt(interaction.fields.getTextInputValue("endTimestamp"));
		const shouldMakeEvent = startTimestamp && endTimestamp;

		const errors = [];

		if (imageURL) {
			try {
				new URL(imageURL);
			} catch (error) {
				errors.push(error.message);
			}
		}

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
			interaction.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${errors.join("\n• ")}`, ephemeral: true });
			return;
		}

		const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId, slotNumber, state: "open" } });
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
			if (bounty.scheduledEventId) {
				interaction.guild.scheduledEvents.edit(bounty.scheduledEventId, eventPayload);
			} else {
				const event = await interaction.guild.scheduledEvents.create(eventPayload);
				bounty.scheduledEventId = event.id;
			}
		} else if (bounty.scheduledEventId) {
			interaction.guild.scheduledEvents.delete(bounty.scheduledEventId);
			bounty.scheduledEventId = null;
		}
		bounty.save();

		// update bounty board
		const hunterGuild = await database.models.Guild.findByPk(interaction.guildId);
		const poster = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId } });
		const bountyEmbed = await bounty.asEmbed(interaction.guild, poster, hunterGuild);
		if (hunterGuild.bountyBoardId) {
			//TODO figure out how to trip auto-mod or re-add taboos
			interaction.guild.channels.fetch(hunterGuild.bountyBoardId).then(bountyBoard => {
				bountyBoard.threads.fetch(bounty.postingId);
			}).then(posting => {
				posting.edit({ embeds: [bountyEmbed] });
			})
		}

		interaction.update({ content: "Bounty edited!", components: [] });
		interaction.channel.send(hunterGuild.sendAnnouncement({ content: `${interaction.member} has edited one of their bounties:`, embeds: [bountyEmbed] }));
	}
);
