const { StringSelectMenuBuilder, MessageFlags, PermissionFlagsBits, ModalBuilder, TextDisplayBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { selectOptionsFromBounties, bountyEmbed, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { Company } = require("../../../database/models");
const { timeConversion } = require("../../../shared");

module.exports = new SubcommandWrapper("showcase", "Show the embed for an evergreen bounty",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const existingBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		if (existingBounties.length < 1) {
			interaction.reply({ content: "This server doesn't have any open evergreen bounties posted.", flags: MessageFlags.Ephemeral });
			return;
		}

		const labelIdBountyId = "bounty-id";
		const labelIdCustomMessage = "custom-message";
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Showcase an Evergreen Bounty")
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent("Unlike normal bounty showcases, an evergreen showcase does not increase the reward of the showcased bounty and is not rate-limited.")
			)
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(existingBounties))
					),
				new LabelBuilder().setLabel("Custom Message")
					.setTextInputComponent(
						new TextInputBuilder().setCustomId(labelIdCustomMessage)
							.setStyle(TextInputStyle.Paragraph)
							.setPlaceholder("Add a custom message to the showcase...")
							.setRequired(false)
					)
			);
		await interaction.showModal(modal);
		const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
			.catch(butIgnoreInteractionCollectorErrors);
		if (!modalSubmission) {
			return;
		}

		const bounty = await logicLayer.bounties.findBounty(modalSubmission.fields.getStringSelectValues(labelIdBountyId)[0]);
		if (bounty?.state !== "open") {
			modalSubmission.reply({ content: "The bounty you selected appears to have been taken-down before the showcase could resolve.", flags: MessageFlags.Ephemeral });
			return;
		}

		const currentCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(origin.company.id)));
		const payload = { embeds: [bountyEmbed(bounty, modalSubmission.guild.members.me, currentCompanyLevel, false, origin.company, new Set())] };
		const extraText = modalSubmission.fields.getTextInputValue(labelIdCustomMessage);
		if (extraText) {
			payload.content = extraText;
		}
		if (!modalSubmission.memberPermissions?.has(PermissionFlagsBits.MentionEveryone)) {
			payload.allowedMentions = { parse: [] };
		}
		modalSubmission.reply(payload);
	}
);
