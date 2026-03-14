const { StringSelectMenuBuilder, MessageFlags, bold, ModalBuilder, LabelBuilder, TextDisplayBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { Bounty, Hunter } = require("../../../database/models");
const { emojiFromNumber, refreshBountyThreadStarterMessage, addLogMessageToBountyThread, addCompanyAnnouncementPrefix, butIgnoreInteractionCollectorErrors, selectOptionsFromBountiesWithBaseRewardAsDescription, truncateTextToLength } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { timeConversion } = require("../../../shared");
const { SelectMenuLimits } = require("@sapphire/discord.js-utilities");

module.exports = new SubcommandWrapper("swap", "Move one of your bounties to another slot to change its reward",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const startingPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
		const bountySlotCount = Hunter.getBountySlotCount(startingPosterLevel, origin.company.maxSimBounties);
		if (bountySlotCount < 2) {
			interaction.reply({ content: "You currently only have 1 bounty slot in this server.", flags: MessageFlags.Ephemeral });
			return;
		}

		const openBounties = await logicLayer.bounties.mapOpenBountiesBySlotNumber(origin.user.id, origin.company.id);
		if (openBounties.size < 1) {
			interaction.reply({ content: "You don't seem to have any open bounties at the moment.", flags: MessageFlags.Ephemeral });
			return;
		}

		const slotOptions = [];
		for (let i = 0; i < bountySlotCount; i++) {
			const slotNumber = i + 1;
			const matchingBounty = openBounties.get(slotNumber);
			const option = { emoji: emojiFromNumber(slotNumber), label: `Slot ${slotNumber} (Base Reward: ${Bounty.calculateCompleterReward(startingPosterLevel, slotNumber, 0)} XP)`, value: slotNumber.toString() };
			if (matchingBounty) {
				option.description = truncateTextToLength(`Swap With: ${matchingBounty.title}`, SelectMenuLimits.MaximumLengthOfDescriptionOfOption);
			}
			slotOptions.push(option);
		}

		const labelIdBountyId = "bounty-id";
		const labelIdSlot = "slot";
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Swap Bounty Rewards")
			.addTextDisplayComponents(new TextDisplayBuilder().setContent("Swapping a bounty to another slot will change the XP reward for that bounty."))
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBountiesWithBaseRewardAsDescription(openBounties, startingPosterLevel))
					),
				new LabelBuilder().setLabel("Bounty Slot")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdSlot)
							.setPlaceholder("Select a bounty slot...")
							.setOptions(slotOptions)
					)
			);
		await interaction.showModal(modal);
		const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
			.catch(butIgnoreInteractionCollectorErrors);
		if (!modalSubmission) {
			return;
		}

		let sourceBounty = await logicLayer.bounties.findBounty(modalSubmission.fields.getStringSelectValues(labelIdBountyId)[0]);
		if (sourceBounty?.state !== "open") {
			modalSubmission.reply({ content: "The selected bounty appears to already have been completed.", flags: MessageFlags.Ephemeral });
			return;
		}

		const destinationSlot = Number(modalSubmission.fields.getStringSelectValues(labelIdSlot)[0]);
		if (sourceBounty.slotNumber === destinationSlot) {
			modalSubmission.reply({ content: `${bold(sourceBounty.title)} is already in slot ${destinationSlot}.`, flags: MessageFlags.Ephemeral });
			return;
		}

		await origin.company.reload();
		const currentPosterLevel = (await origin.hunter.reload()).getLevel(origin.company.xpCoefficient);
		if (destinationSlot > Hunter.getBountySlotCount(currentPosterLevel, origin.company.maxSimBounties)) {
			modalSubmission.reply({ content: "You no longer have the bounty slot you are trying to swap into.", flags: MessageFlags.Ephemeral });
			return;
		}

		const sourceSlot = sourceBounty.slotNumber;
		let destinationBounty = await logicLayer.bounties.findBounty({ slotNumber: destinationSlot, userId: origin.user.id, companyId: origin.company.id, state: "open" });
		const destinationRewardValue = Bounty.calculateCompleterReward(currentPosterLevel, destinationSlot, sourceBounty.showcaseCount);

		sourceBounty = await sourceBounty.update({ slotNumber: destinationSlot });
		refreshBountyThreadStarterMessage(modalSubmission.guild, origin.company, sourceBounty, await sourceBounty.getScheduledEvent(modalSubmission.guild.scheduledEvents), modalSubmission.member, currentPosterLevel, await logicLayer.bounties.getHunterIdSet(sourceBounty.id));
		addLogMessageToBountyThread(modalSubmission.guild, origin.company, sourceBounty, `Switched this bounty's slot from ${sourceSlot} to ${destinationSlot}. It is now worth ${destinationRewardValue} XP.`);

		if (destinationBounty) {
			destinationBounty = await destinationBounty.update({ slotNumber: sourceSlot });
			refreshBountyThreadStarterMessage(modalSubmission.guild, origin.company, destinationBounty, await destinationBounty.getScheduledEvent(modalSubmission.guild.scheduledEvents), modalSubmission.member, currentPosterLevel, await logicLayer.bounties.getHunterIdSet(destinationBounty.id));
			addLogMessageToBountyThread(modalSubmission.guild, origin.company, destinationBounty, `Switched this bounty's slot from ${destinationSlot} to ${sourceSlot}. It is now worth ${Bounty.calculateCompleterReward(currentPosterLevel, sourceSlot, destinationBounty.showcaseCount)} XP.`);
		}

		modalSubmission.reply(addCompanyAnnouncementPrefix(origin.company, { content: `${modalSubmission.member}'s bounty, ${bold(sourceBounty.title)} is now worth ${destinationRewardValue} XP.` }));
	}
);
