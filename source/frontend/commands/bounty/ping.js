const { ModalBuilder, UserSelectMenuBuilder, TextInputBuilder, StringSelectMenuBuilder, LabelBuilder, TextInputStyle } = require("discord.js");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { SubcommandWrapper } = require("../../classes");
const { bountyPing } = require("../../shared/flows/bountyPing");
const { selectOptionsFromBounties, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { timeConversion } = require("../../../shared");

module.exports = new SubcommandWrapper("ping", "Mention bounty hunters that reacted to your bounty's thread or event",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const labelIdBountyId = "bounty-id";
		const labelIdMessage = "message";
		const labelIdExcludedBountyHunters = "bounty-hunters";
		const maxHunters = 10;
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Ping Interested Bounty Hunters")
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(await logicLayer.bounties.findOpenBounties(origin.user.id, origin.company.id)))
					),
				new LabelBuilder().setLabel("Message")
					.setTextInputComponent(
						new TextInputBuilder().setCustomId(labelIdMessage)
							.setStyle(TextInputStyle.Short)
							.setPlaceholder("Add a message to go with the ping...")
					),
				new LabelBuilder().setLabel("Hunters to Exclude")
					.setUserSelectMenuComponent(
						new UserSelectMenuBuilder().setCustomId(labelIdExcludedBountyHunters)
							.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
							.setMaxValues(maxHunters)
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
		if (!bounty || bounty.state !== "open") {
			modalSubmission.reply({ content: "Your selected bounty could not be found.", flags: MessageFlags.Ephemeral });
			return;
		}

		bountyPing(logicLayer, modalSubmission, { message: labelIdMessage, excludedBountyHunters: labelIdExcludedBountyHunters }, bounty, origin.company.bountyBoardId);
	}
);
