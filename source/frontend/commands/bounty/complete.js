const { MessageFlags, userMention, channelMention, bold, ModalBuilder, LabelBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder, PermissionFlagsBits, strikethrough } = require("discord.js");
const { timeConversion } = require("../../../shared");
const { commandMention, bountyEmbed, goalCompletionEmbed, sendRewardMessage, syncRankRoles, unarchiveAndUnlockThread, rewardSummary, consolidateHunterReceipts, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, butIgnoreInteractionCollectorErrors, selectOptionsFromBounties, butIgnoreErrorIf, isUnknownGuildScheduledEventError, isMissingPermissionError, getBountyBoardThread, refreshBountyBoardThread, auditReasonBountyComplete } = require("../../shared");
const { SubcommandFunctionality } = require("../../classes");
const { Company } = require("../../../database/models");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { ensureHunterHasOpenBounty } = require("../_earlyOuts");

module.exports = new SubcommandFunctionality("complete", "Close one of your open bounties, distributing rewards to hunters who turned it in",
	ensureHunterHasOpenBounty(async function executeSubcommand(interaction, theater, isDevMode, logicLayer, bounties) {
		const labelIdBountyId = "bounty-id";
		const labelIdBountyHunters = "hunters";
		const maxHunters = 10;
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Mark your Bounty Complete!")
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(bounties))
					),
				new LabelBuilder().setLabel("Extra Turn-Ins")
					.setUserSelectMenuComponent(
						new UserSelectMenuBuilder().setCustomId(labelIdBountyHunters)
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
		if (bounty?.state !== "open") {
			modalSubmission.reply({ content: "Your selected bounty no longer appears to be open.", flags: MessageFlags.Ephemeral });
			return;
		}

		// disallow completion within 5 minutes of creating bounty
		if (!isDevMode && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
			modalSubmission.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty record-turn-ins")} so you won't forget instead.`, flags: MessageFlags.Ephemeral });
			return;
		}

		// Early-out if no completers
		const completions = await logicLayer.bounties.findBountyCompletions(bounty.id);
		const memberCollection = await modalSubmission.guild.members.fetch({ user: completions.map(reciept => reciept.userId) });
		const validatedHunters = new Map();
		for (const [memberId, member] of memberCollection) {
			if (isDevMode || !member.user.bot) {
				const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, theater.company.id);
				if (!hunter.isBanned) {
					validatedHunters.set(memberId, hunter);
				}
			}
		}

		const extraTurnIns = modalSubmission.fields.getSelectedMembers(labelIdBountyHunters);
		if (extraTurnIns !== null) {
			for (const [memberId, member] of extraTurnIns) {
				if (isDevMode || !(member.user.bot || validatedHunters.has(memberId))) {
					const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, theater.company.id);
					if (!hunter.isBanned) {
						validatedHunters.set(memberId, hunter);
					}
				}
			}
		}
		if (validatedHunters.size < 1) {
			modalSubmission.reply({ content: `There aren't any eligible pending turn-ins for this bounty. If you'd like to close your bounty without paying out rewards, use ${commandMention("bounty take-down")}.`, flags: MessageFlags.Ephemeral })
			return;
		}

		await modalSubmission.deferReply();

		const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

		let hunterMap = await logicLayer.hunters.getCompanyHunterMap(theater.company.id);

		const previousCompanyLevel = Company.getLevel(theater.company.getXP(hunterMap));
		const hunterReceipts = await logicLayer.bounties.completeBounty(bounty, theater.hunter, validatedHunters, season, theater.company);
		const { companyReceipt, goalProgress } = await logicLayer.goals.progressGoal(theater.company, "bounties", theater.hunter, season);
		companyReceipt.guildName = modalSubmission.guild.name;
		hunterMap = await logicLayer.hunters.getCompanyHunterMap(theater.company.id);
		const currentCompanyLevel = Company.getLevel(theater.company.getXP(hunterMap));
		if (previousCompanyLevel < currentCompanyLevel) {
			companyReceipt.levelUp = currentCompanyLevel;
		}
		const descendingRanks = await logicLayer.ranks.findAllRanks(theater.company.id);
		const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await modalSubmission.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, modalSubmission.guild.members);
		consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
		const rewardMessageContent = rewardSummary("bounty", companyReceipt, hunterReceipts, theater.company.maxSimBounties);

		const acknowledgeOptions = { content: `${userMention(bounty.userId)}'s bounty, ` };
		if (goalProgress.goalCompleted) {
			acknowledgeOptions.embeds = [goalCompletionEmbed(goalProgress.contributorIds)];
		}

		if (theater.company.bountyBoardId) {
			acknowledgeOptions.content += `${channelMention(bounty.postingId)}, was completed!`;
			modalSubmission.editReply(acknowledgeOptions);

			const auditLogReason = auditReasonBountyComplete;
			const bountyThread = await getBountyBoardThread(modalSubmission.guild, theater.company.bountyBoardId, bounty.postingId);
			if (bountyThread) {
				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					refreshBountyBoardThread(await bountyThread.fetchStarterMessage(), { embed: bountyEmbed(bounty, modalSubmission.member, theater.hunter.getLevel(theater.company.xpCoefficient), true, theater.company, new Set([...validatedHunters.keys()]), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents), goalProgress), title: strikethrough(bounty.title) }, auditLogReason);
					await unarchiveAndUnlockThread(bountyThread, auditLogReason);
				}
				if (bountyThread.sendable) {
					bountyThread.send({ content: rewardMessageContent, flags: MessageFlags.SuppressNotifications });
				}
				bountyThread.edit({ archived: true, appliedTags: [theater.company.bountyBoardCompletedTagId], reason: auditLogReason });
			}
		} else {
			acknowledgeOptions.content += `${bold(bounty.title)}, was completed!`;
			modalSubmission.editReply(acknowledgeOptions).then(message => {
				sendRewardMessage(message, rewardMessageContent, `${bounty.title} Rewards`);
			})
		}

		if (theater.company.scoreboardIsSeasonal) {
			refreshReferenceChannelScoreboardSeasonal(theater.company, modalSubmission.guild, participationMap, descendingRanks, goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(theater.company, modalSubmission.guild, hunterMap, goalProgress);
		}

		if (bounty.scheduledEventId) {
			modalSubmission.guild.scheduledEvents.delete(bounty.scheduledEventId).catch(butIgnoreErrorIf(isUnknownGuildScheduledEventError, isMissingPermissionError));
		}
	})
);
