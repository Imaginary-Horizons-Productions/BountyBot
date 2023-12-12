const { CommandInteraction, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { Sequelize } = require("sequelize");
const { MAX_EMBEDS_PER_MESSAGE, MAX_EMBED_TITLE_LENGTH } = require("../../constants");
const { checkTextsInAutoMod } = require("../../util/textUtil");
const { generateBountyBoardThread } = require("../../util/scoreUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const existingBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" } });
	let slotNumber = null;
	for (let slotCandidate = 1; slotCandidate <= MAX_EMBEDS_PER_MESSAGE; slotCandidate++) {
		if (!existingBounties.some(bounty => bounty.slotNumber === slotCandidate)) {
			slotNumber = slotCandidate;
			break;
		}
	}

	if (slotNumber === null) {
		interaction.reply({ content: "Each server can only have 10 Evergreen Bounties.", ephemeral: true });
		return;
	}

	interaction.showModal(
		new ModalBuilder().setCustomId(interaction.id)
			.setTitle("New Evergreen Bounty")
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
				)
			)
	);

	interaction.awaitModalSubmit({ filter: submission => submission.customId === interaction.id, time: timeConversion(5, "m", "ms") }).then(async interaction => {
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

		const [company] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
		const bounty = await database.models.Bounty.create(rawBounty);

		// post in bounty board forum
		const bountyEmbed = await bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), false, database);
		interaction.reply(company.sendAnnouncement({ content: `A new evergreen bounty has been posted:`, embeds: [bountyEmbed] })).then(() => {
			if (company.bountyBoardId) {
				interaction.guild.channels.fetch(company.bountyBoardId).then(async bountyBoard => {
					const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
					const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), false, database)));
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
				});
			} else {
				interaction.followUp({ content: "Looks like your server doesn't have a bounty board channel. Make one with `/create-default bounty-board-forum`?", ephemeral: true });
			}
		});
	}).catch(console.error)
};

module.exports = {
	data: {
		name: "post",
		description: "Post an evergreen bounty, limit 10"
	},
	executeSubcommand
};
