const { CommandInteraction, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { MAX_EMBEDS_PER_MESSAGE, MAX_EMBED_TITLE_LENGTH, SKIP_INTERACTION_HANDLING } = require("../../constants");
const { textsHaveAutoModInfraction, timeConversion, commandMention } = require("../../util/textUtil");
const { generateBountyBoardThread } = require("../../util/scoreUtil");
const { findOrCreateCompany } = require("../../logic/companies");

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
		interaction.reply({ content: "Each server can only have 10 Evergreen Bounties.", flags: [MessageFlags.Ephemeral] });
		return;
	}

	interaction.showModal(
		new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
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

	interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${interaction.id}`, time: timeConversion(5, "m", "ms") }).then(async interaction => {
		const title = interaction.fields.getTextInputValue("title");
		const description = interaction.fields.getTextInputValue("description");

		if (await textsHaveAutoModInfraction(interaction.channel, interaction.member, [title, description], "evergreen post")) {
			interaction.reply({ content: "Your evergreen bounty could not be posted because it tripped AutoMod.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const rawBounty = {
			userId: interaction.client.user.id,
			companyId: interaction.guildId,
			slotNumber: parseInt(slotNumber),
			isEvergreen: true,
			title
		};
		if (description) {
			rawBounty.description = description;
		}

		const imageURL = interaction.fields.getTextInputValue("imageURL");
		if (imageURL) {
			try {
				new URL(imageURL);
				rawBounty.attachmentURL = imageURL;
			} catch (error) {
				interaction.message.edit({ components: [] });
				interaction.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${error.message}`, flags: [MessageFlags.Ephemeral] });
				return;
			}
		}

		const [company] = await findOrCreateCompany(interaction.guild.id);
		const bounty = await database.models.Bounty.create(rawBounty);

		// post in bounty board forum
		const bountyEmbed = await bounty.embed(interaction.guild, company.level, false, company, []);
		interaction.reply(company.sendAnnouncement({ content: `A new evergreen bounty has been posted:`, embeds: [bountyEmbed] })).then(() => {
			if (company.bountyBoardId) {
				interaction.guild.channels.fetch(company.bountyBoardId).then(async bountyBoard => {
					const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
					const embeds = await Promise.all(evergreenBounties.map(async bounty => bounty.embed(interaction.guild, company.level, false, company, await database.models.Completion.findAll({ where: { bountyId: bounty.id } }))));
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
				interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: [MessageFlags.Ephemeral] });
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
