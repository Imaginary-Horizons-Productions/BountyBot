const { MessageFlags, userMention, bold, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, LabelBuilder, PermissionFlagsBits } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { sentenceListEN, selectOptionsFromBounties, butIgnoreInteractionCollectorErrors, getBountyBoardThread, bountyEmbed, unarchiveAndUnlockThread } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { ensureHunterHasOpenBounty } = require("../_earlyOuts");

module.exports = new SubcommandWrapper("revoke-turn-ins", "Revoke the turn-ins of up to 5 bounty hunters on one of your bounties",
	ensureHunterHasOpenBounty(async function executeSubcommand(interaction, theater, isDevMode, logicLayer, bounties) {
		const labelIdBountyId = "bounty-id";
		const labelIdBountyHunters = "bounty-hunters";
		const maxHunters = 10;
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Revoke Bounty Turn-Ins")
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

		const removedIds = modalSubmission.fields.getSelectedMembers(labelIdBountyHunters).map((_, key) => key);
		await logicLayer.bounties.deleteSelectedBountyCompletions(bounty.id, removedIds);
		const mentionList = sentenceListEN(removedIds.map(id => userMention(id)));
		modalSubmission.reply({ content: `These bounty hunters' turn-ins of ${bold(bounty.title)} have been revoked: ${mentionList}`, flags: MessageFlags.Ephemeral });

		const bountyThread = await getBountyBoardThread(modalSubmission.guild, theater.company.bountyBoardId, bounty.postingId);
		if (bountyThread) {
			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				(await bountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, theater.hunter.getLevel(theater.company.xpCoefficient), false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
				await unarchiveAndUnlockThread(bountyThread, "bounty turn-ins revoked by poster");
			}
			if (bountyThread.sendable) {
				bountyThread.send({ content: `${mentionList} ${removedIds.length === 1 ? "has had their turn-in" : "have had their turn-ins"} revoked.` });
			}
		}
	})
);
