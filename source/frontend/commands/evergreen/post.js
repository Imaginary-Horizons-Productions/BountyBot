const { ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, DiscordjsErrorCodes, LabelBuilder } = require("discord.js");
const { EmbedLimits } = require("@sapphire/discord.js-utilities");
const { SubcommandWrapper } = require("../../classes");
const { SKIP_INTERACTION_HANDLING, MAX_EVERGREEN_SLOTS } = require("../../../constants");
const { textsHaveAutoModInfraction, commandMention, buildBountyEmbed, sendAnnouncement, updateEvergreenBountyBoard } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { Company } = require("../../../database/models");

module.exports = new SubcommandWrapper("post", `Post an evergreen bounty, limit ${MAX_EVERGREEN_SLOTS}`,
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const existingBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		let slotNumber = null;
		for (let slotCandidate = 1; slotCandidate <= MAX_EVERGREEN_SLOTS; slotCandidate++) {
			if (!existingBounties.some(bounty => bounty.slotNumber === slotCandidate)) {
				slotNumber = slotCandidate;
				break;
			}
		}

		if (slotNumber === null) {
			interaction.reply({ content: `Each server can only have ${MAX_EVERGREEN_SLOTS} Evergreen Bounties.`, flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.showModal(
			new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("New Evergreen Bounty")
				.addLabelComponents(
					new LabelBuilder().setLabel("Title")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId("title")
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Discord markdown allowed...")
								.setMaxLength(EmbedLimits.MaximumTitleLength)
						),
					new LabelBuilder().setLabel("Description")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId("description")
								.setStyle(TextInputStyle.Paragraph)
								.setPlaceholder("Bounties with clear instructions are easier to complete...")
						),
					new LabelBuilder().setLabel("Image URL")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId("imageURL")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
						)
				)
		);

		return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${interaction.id}`, time: timeConversion(5, "m", "ms") }).then(async interaction => {
			const title = interaction.fields.getTextInputValue("title");
			const description = interaction.fields.getTextInputValue("description");

			if (await textsHaveAutoModInfraction(interaction.channel, interaction.member, [title, description], "evergreen post")) {
				interaction.reply({ content: "Your evergreen bounty could not be posted because it tripped AutoMod.", flags: MessageFlags.Ephemeral });
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
					interaction.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${error.message}`, flags: MessageFlags.Ephemeral });
					return;
				}
			}

			const bounty = await logicLayer.bounties.createBounty(rawBounty);
			existingBounties.push(bounty);

			// post in bounty board forum
			const currentCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));
			const bountyEmbed = await buildBountyEmbed(bounty, interaction.guild, currentCompanyLevel, false, origin.company, new Set());
			interaction.reply(sendAnnouncement(origin.company, { content: `A new evergreen bounty has been posted:`, embeds: [bountyEmbed] })).then(async () => {
				if (origin.company.bountyBoardId) {
					const hunterIdMap = {};
					for (const bounty of existingBounties) {
						hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
					}
					interaction.guild.channels.fetch(origin.company.bountyBoardId).then(bountyBoard => updateEvergreenBountyBoard(bountyBoard, existingBounties, origin.company, currentCompanyLevel, interaction.guild, hunterIdMap)).then(thread => {
						bounty.postingId = thread.id;
						bounty.save()
					});
				} else if (!interaction.member.manageable) {
					interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
				}
			});
		}).catch(error => {
			if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		})
	}
);
