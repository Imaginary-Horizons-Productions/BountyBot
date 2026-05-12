const { StringSelectMenuBuilder, MessageFlags, bold, ModalBuilder, LabelBuilder, TextDisplayBuilder, PermissionFlagsBits } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { Bounty, Hunter } = require("../../../database/models");
const { emojiFromNumber, addCompanyAnnouncementPrefix, butIgnoreInteractionCollectorErrors, selectOptionsFromBountiesWithBaseRewardAsDescription, truncateTextToLength, getBountyBoardThread, unarchiveAndUnlockThread, threadCanRecieveMessages, bountyEmbed } = require("../../shared");
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
		const auditLogReason = destinationBounty ?
			`bounty poster swapped slots of bounties ${sourceSlot} and ${destinationSlot}` :
			`bounty swapped from slot ${sourceSlot} to ${destinationSlot} by poster`;

		sourceBounty = await sourceBounty.update({ slotNumber: destinationSlot });
		const sourceBountyThread = await getBountyBoardThread(modalSubmission.guild, origin.company.bountyBoardId, sourceBounty.postingId);
		if (sourceBountyThread) {
			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				(await sourceBountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(sourceBounty, modalSubmission.member, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(sourceBounty.id), await sourceBounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
				await unarchiveAndUnlockThread(sourceBountyThread, auditLogReason);
			}
			if (threadCanRecieveMessages(sourceBountyThread)) {
				sourceBountyThread.send({ content: `This bounty's slot was switched from ${sourceSlot} to ${destinationSlot}. It is now worth ${destinationRewardValue} XP.`, flags: MessageFlags.SuppressNotifications });
			}
		}

		if (destinationBounty) {
			destinationBounty = await destinationBounty.update({ slotNumber: sourceSlot });
			const destinationBountyThread = await getBountyBoardThread(modalSubmission.guild, origin.company.bountyBoardId, destinationBounty.postingId);
			if (destinationBountyThread) {
				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					(await destinationBountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(destinationBounty, modalSubmission.member, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(destinationBounty.id), await destinationBounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
					await unarchiveAndUnlockThread(destinationBountyThread, auditLogReason);
				}
				if (threadCanRecieveMessages(destinationBountyThread)) {
					destinationBountyThread.send({ content: `This bounty's slot was switched from ${destinationSlot} to ${sourceSlot}. It is now worth ${Bounty.calculateCompleterReward(currentPosterLevel, sourceSlot, destinationBounty.showcaseCount)} XP.`, flags: MessageFlags.SuppressNotifications });
				}
			}
		}

		modalSubmission.reply(addCompanyAnnouncementPrefix(origin.company, { content: `${modalSubmission.member}'s bounty, ${bold(sourceBounty.title)} is now worth ${destinationRewardValue} XP.` }));
	}
);
