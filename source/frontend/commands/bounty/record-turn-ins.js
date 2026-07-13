const { userMention, bold, MessageFlags, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, LabelBuilder, PermissionFlagsBits } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { sentenceListEN, randomCongratulatoryPhrase, selectOptionsFromBounties, butIgnoreInteractionCollectorErrors, getBountyBoardThread, bountyEmbed, unarchiveAndUnlockThread } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { ensureHunterHasOpenBounty } = require("../_earlyOuts");

module.exports = new SubcommandWrapper("record-turn-ins", "Record turn-ins of one of your bounties for up to 5 bounty hunters",
	ensureHunterHasOpenBounty(async function executeSubcommand(interaction, theater, isDevMode, logicLayer, bounties) {
		const labelIdBountyId = "bounty-id";
		const labelIdBountyHunters = "bounty-hunters";
		const maxHunters = 10;
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Record Bounty Turn-Ins")
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(bounties))
					),
				new LabelBuilder().setLabel("Bounty Hunters")
					.setUserSelectMenuComponent(
						new UserSelectMenuBuilder().setCustomId(labelIdBountyHunters)
							.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
							.setMaxValues(maxHunters)
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

		const { eligibleTurnInIds, newTurnInIds, bannedTurnInIds } = await logicLayer.bounties.checkTurnInEligibility(bounty, Array.from(modalSubmission.fields.getSelectedMembers(labelIdBountyHunters).values()), isDevMode);
		const sentences = [];
		if (bannedTurnInIds.size > 0) {
			sentences.push(`The following users were skipped due to currently being banned from using BountyBot: ${sentenceListEN(Array.from(bannedTurnInIds.values().map(id => userMention(id))))}`);
		}
		if (newTurnInIds.size < 1) {
			sentences.unshift("No new turn-ins were able to be recorded. You cannot credit yourself or bots for your own bounties.");
		} else {
			await logicLayer.bounties.bulkCreateCompletions(bounty.id, bounty.companyId, Array.from(eligibleTurnInIds), null);
			const newTurnInList = sentenceListEN(Array.from(newTurnInIds.values().map(id => userMention(id))));
			sentences.unshift(`Turn-ins of ${bold(bounty.title)} have been recorded for the following hunters: ${newTurnInList}`);

			const bountyThread = await getBountyBoardThread(modalSubmission.guild, theater.company.bountyBoardId, bounty.postingId);
			if (bountyThread) {
				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					(await bountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, theater.hunter.getLevel(theater.company.xpCoefficient), false, theater.company, eligibleTurnInIds, await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
					await unarchiveAndUnlockThread(bountyThread, "bounty turn-ins recorded by poster");
				}
				if (bountyThread.sendable) {
					bountyThread.send({ content: `${newTurnInList} ${newTurnInIds.size === 1 ? "has" : "have"} turned in this bounty! ${randomCongratulatoryPhrase()}!` });
				}
			}
		}

		modalSubmission.reply({ content: sentences.join("\n\n"), flags: MessageFlags.Ephemeral });
	})
);
