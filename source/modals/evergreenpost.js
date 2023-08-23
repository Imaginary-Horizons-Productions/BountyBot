const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { generateBountyBoardThread, checkTextsInAutoMod } = require('../helpers');

const customId = "evergreenpost";
module.exports = new InteractionWrapper(customId, 3000,
	/** Serialize data into a bounty, then announce with showcase embed */
	async (interaction, [slotNumber]) => {
		const title = interaction.fields.getTextInputValue("title");
		const description = interaction.fields.getTextInputValue("description");

		const isBlockedByAutoMod = await checkTextsInAutoMod(interaction.channel, interaction.member, [title, description], "evergreen post");
		if (isBlockedByAutoMod) {
			interaction.reply({ content: "Your evergreen bounty could not be posted because it tripped AutoMod.", ephemeral: true });
			return;
		}

		const rawBounty = {
			userId: interaction.client.user.id,
			companyId: interaction.guildId,
			slotNumber: parseInt(slotNumber),
			isEvergreen: true,
			title,
			description
		};

		const imageURL = interaction.fields.getTextInputValue("imageURL");
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

		const [company] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId }, defaults: { Season: { companyId: interaction.guildId } }, include: database.models.Company.Season });
		const bounty = await database.models.Bounty.create(rawBounty);

		// post in bounty board forum
		const bountyEmbed = await bounty.asEmbed(interaction.guild, company.level, company.eventMultiplierString());
		interaction.reply(company.sendAnnouncement({ content: `A new evergreen bounty has been posted:`, embeds: [bountyEmbed] })).then(() => {
			if (company.bountyBoardId) {
				interaction.guild.channels.fetch(company.bountyBoardId).then(async bountyBoard => {
					const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
					const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.eventMultiplierString())));
					if (company.evergreenThreadId) {
						return bountyBoard.threads.fetch(company.evergreenThreadId).then(async thread => {
							const message = await thread.fetchStarterMessage();
							message.edit({ embeds });
							return thread;
						});
					} else {
						return generateBountyBoardThread(bountyBoard.threads, embeds, company);
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
