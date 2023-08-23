const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { checkTextsInAutoMod } = require('../helpers');

const customId = "evergreeneditmodal";
module.exports = new InteractionWrapper(customId, 3000,
	/** Serialize data into a bounty, then announce with showcase embed */
	async (interaction, [slotNumber]) => {
		const title = interaction.fields.getTextInputValue("title");
		const description = interaction.fields.getTextInputValue("description");

		const isBlockedByAutoMod = await checkTextsInAutoMod(interaction.channel, interaction.member, [title, description], "evergreen edit");
		if (isBlockedByAutoMod) {
			interaction.reply({ content: "Your edit could not be completed because it tripped AutoMod.", ephemeral: true });
			return;
		}

		const imageURL = interaction.fields.getTextInputValue("imageURL");
		if (imageURL) {
			try {
				new URL(imageURL);
			} catch (error) {
				interaction.reply({ content: `The following errors were encountered while editing your bounty **${title}**:\n• ${error.message}`, ephemeral: true });
			}
		}

		const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.client.user.id, companyId: interaction.guildId, slotNumber, state: "open" } });
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
		const company = await database.models.Company.findByPk(interaction.guildId);
		const bountyEmbed = await bounty.asEmbed(interaction.guild, company.level, company.eventMultiplierString());
		const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
		const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.eventMultiplierString())));
		if (company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
			bountyBoard.threads.fetch(company.evergreenThreadId).then(async thread => {
				const message = await thread.fetchStarterMessage();
				message.edit({ embeds });
			});
		}

		interaction.update({ content: "Bounty edited!", components: [] });
		interaction.channel.send(company.sendAnnouncement({ content: `${interaction.member} has edited an evergreen bounty:`, embeds: [bountyEmbed] }));
	}
);
