const { StringSelectMenuBuilder, MessageFlags, ModalBuilder, LabelBuilder, TextDisplayBuilder, bold } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { selectOptionsFromBounties, refreshEvergreenBountiesThread, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { Bounty, Company } = require("../../../database/models");
const { timeConversion } = require("../../../shared");

module.exports = new SubcommandWrapper("swap", "Swap the rewards of two evergreen bounties",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const existingBounties = await logicLayer.bounties.findEvergreenBounties(origin.company.id);
		if (existingBounties.length < 2) {
			interaction.reply({ content: "There must be at least 2 evergreen bounties for this server to swap.", flags: MessageFlags.Ephemeral });
			return;
		}

		const labelIdSourceBountyId = "first-bounty-id";
		const labelIdDestinationBountyId = "second-bounty-id";
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Swap Evergreen Bounty Rewards")
			.addTextDisplayComponents(new TextDisplayBuilder().setContent("Swapping a bounty to another slot will change the XP reward for that bounty."))
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty 1")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdSourceBountyId)
							.setPlaceholder("Select an evergreen bounty...")
							.setOptions(selectOptionsFromBounties(existingBounties))
					),
				new LabelBuilder().setLabel("Bounty 2")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdDestinationBountyId)
							.setPlaceholder("Select an evergreen bounty...")
							.setOptions(selectOptionsFromBounties(existingBounties))
					)
			);
		await interaction.showModal(modal);
		const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
			.catch(butIgnoreInteractionCollectorErrors);
		if (!modalSubmission) {
			return;
		}

		const [sourceBountyId] = modalSubmission.fields.getStringSelectValues(labelIdSourceBountyId);
		const [destinationBountyId] = modalSubmission.fields.getStringSelectValues(labelIdDestinationBountyId);
		if (sourceBountyId === destinationBountyId) {
			modalSubmission.reply({ content: "It appears you've selected the same bounty twice.", flags: MessageFlags.Ephemeral });
			return;
		}

		const sourceBounty = await logicLayer.bounties.findBounty(sourceBountyId);
		if (!sourceBounty) {
			modalSubmission.reply({ content: "The first bounty you selected appears to have been taken down before the swap could be resolved.", flags: MessageFlags.Ephemeral });
			return;
		}
		const sourceSlot = sourceBounty.slotNumber;

		const destinationBounty = await logicLayer.bounties.findBounty(destinationBountyId);
		if (!sourceBounty) {
			modalSubmission.reply({ content: "The second bounty you selected appears to have been taken down before the swap could be resolved.", flags: MessageFlags.Ephemeral });
			return;
		}
		const destinationSlot = destinationBounty.slotNumber;

		await sourceBounty.update({ slotNumber: destinationSlot });
		await destinationBounty.update({ slotNumber: sourceSlot });

		const currentCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(origin.company.id)));
		// Evergreen bounties are not eligible for showcase bonuses
		modalSubmission.reply(`Some evergreen bounties have been swapped, ${bold(sourceBounty.title)} is now worth ${Bounty.calculateCompleterReward(currentCompanyLevel, destinationSlot, 0)} XP and ${bold(destinationBounty.title)} is now worth ${Bounty.calculateCompleterReward(currentCompanyLevel, sourceSlot, 0)} XP.`);

		if (origin.company.bountyBoardId) {
			const hunterIdMap = {};
			for (const bounty of existingBounties) {
				hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
			}
			modalSubmission.guild.channels.fetch(origin.company.bountyBoardId).then(bountyBoard => {
				refreshEvergreenBountiesThread(bountyBoard, existingBounties, origin.company, currentCompanyLevel, modalSubmission.guild.members.me, hunterIdMap);
			})
		} else if (!modalSubmission.member.manageable) {
			modalSubmission.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
		}
	}
);
