const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { generateBountyBoardThread } = require('../helpers');

const customId = "evergreenpost";
module.exports = new InteractionWrapper(customId, 3000,
	/** Serialize data into a bounty, then announce with showcase embed */
	async (interaction, [slotNumber]) => {
		const title = interaction.fields.getTextInputValue("title");
		const description = interaction.fields.getTextInputValue("description");
		const imageURL = interaction.fields.getTextInputValue("imageURL");

		const rawBounty = {
			userId: interaction.client.user.id,
			guildId: interaction.guildId,
			slotNumber: parseInt(slotNumber),
			isEvergreen: true,
			title,
			description
		};

		if (imageURL) {
			try {
				new URL(imageURL);
				rawBounty.attachmentURL = imageURL;
			} catch (error) {
				interaction.message.edit({ components: [] });
				interaction.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${error.message}`, ephemeral: true });
				return;
			}
		}

		const [hunterGuild] = await database.models.Guild.findOrCreate({ where: { id: interaction.guildId } });
		const bounty = await database.models.Bounty.create(rawBounty);

		// post in bounty board forum
		const bountyEmbed = await bounty.asEmbed(interaction.guild, hunterGuild.level, hunterGuild.eventMultiplierString());
		interaction.reply(hunterGuild.sendAnnouncement({ content: `A new evergreen bounty has been posted:`, embeds: [bountyEmbed] })).then(() => {
			if (hunterGuild.bountyBoardId) {
				//TODO #42 figure out how to trip auto-mod or re-add taboos
				interaction.guild.channels.fetch(hunterGuild.bountyBoardId).then(async bountyBoard => {
					const evergreenBounties = await database.models.Bounty.findAll({ where: { guildId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
					const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, hunterGuild.level, hunterGuild.eventMultiplierString())));
					if (hunterGuild.evergreenThreadId) {
						return bountyBoard.threads.fetch(hunterGuild.evergreenThreadId).then(async thread => {
							const message = await thread.fetchStarterMessage();
							message.edit({ embeds });
							return thread;
						});
					} else {
						return generateBountyBoardThread(bountyBoard.threads, embeds, hunterGuild);
					}
				}).then(thread => {
					bounty.postingId = thread.id;
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
