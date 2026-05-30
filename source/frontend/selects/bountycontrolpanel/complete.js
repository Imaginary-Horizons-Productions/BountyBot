const { MessageFlags, ModalBuilder, TextDisplayBuilder, LabelBuilder, ChannelSelectMenuBuilder, ChannelType, UserSelectMenuBuilder, userMention, PermissionFlagsBits, strikethrough } = require("discord.js");
const { SelectOptionWrapper } = require("../../classes");
const { timeConversion } = require("../../../shared");
const { commandMention, sentenceListEN, butIgnoreInteractionCollectorErrors, syncRankRoles, consolidateHunterReceipts, rewardSummary, refreshBountyBoardThread, unarchiveAndUnlockThread, goalCompletionEmbed, butIgnoreMissingPermissionErrors, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, butIgnoreErrorIf, isUnknownGuildScheduledEventError, isMissingPermissionError, auditReasonBountyComplete, bountyEmbed } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { Company } = require("../../../database/models");
const { ensureBountyExistsAndInteractorIsPoster } = require("./_earlyOuts");
const { RunModeKind } = require("../../../shared/types");

module.exports = new SelectOptionWrapper("complete",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, origin, runMode, logicLayer, [bounty]) => {
			const isDevMode = runMode === RunModeKind.Development;
			// disallow completion within 5 minutes of creating bounty
			if (!isDevMode && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
				interaction.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty record-turn-ins")} so you won't forget instead.`, flags: MessageFlags.Ephemeral });
				return;
			}

			const completions = await logicLayer.bounties.findBountyCompletions(bounty.id);
			const memberCollection = await interaction.guild.members.fetch({ user: completions.map(reciept => reciept.userId) });
			const validatedHunters = new Map();
			const pendingTurnInDisplayNames = [];
			for (const [memberId, member] of memberCollection) {
				if (isDevMode || !member.user.bot) {
					const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, origin.company.id);
					if (!hunter.isBanned) {
						validatedHunters.set(memberId, hunter);
						pendingTurnInDisplayNames.push(member.displayName);
					}
				}
			}

			const labelIdChannel = "channel";
			const labelIdBountyHunters = "bounty-hunters";
			const maxHunters = 10;
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Mark your Bounty Complete!")
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Pending Turn-Ins: ${pendingTurnInDisplayNames.length > 0 ? sentenceListEN(pendingTurnInDisplayNames) : "None yet!"}`))
				.addLabelComponents(
					new LabelBuilder().setLabel("Channel to Announce In")
						.setChannelSelectMenuComponent(
							new ChannelSelectMenuBuilder().setCustomId(labelIdChannel)
								.setPlaceholder("Select a channel...")
								.setChannelTypes(ChannelType.GuildText)
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

			// Early-out if no completers
			const extraTurnIns = modalSubmission.fields.getSelectedMembers(labelIdBountyHunters);
			if (extraTurnIns !== null) {
				for (const [memberId, member] of extraTurnIns) {
					if (isDevMode || !(member.user.bot || validatedHunters.has(memberId))) {
						const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, origin.company.id);
						if (!hunter.isBanned) {
							validatedHunters.set(memberId, hunter);
						}
					}
				}
			}
			if (validatedHunters.size < 1) {
				modalSubmission.reply({ content: `There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use ${commandMention("bounty take-down")}.`, flags: MessageFlags.Ephemeral })
				return;
			}

			if (modalSubmission.channel.sendable) {
				await modalSubmission.deferReply({ flags: MessageFlags.SuppressNotifications });
			}
			const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

			let hunterMap = await logicLayer.hunters.getCompanyHunterMap(origin.company.id);
			const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
			const hunterReceipts = await logicLayer.bounties.completeBounty(bounty, hunterMap.get(bounty.userId), validatedHunters, season, origin.company);
			const { companyReceipt, goalProgress } = await logicLayer.goals.progressGoal(origin.company, "bounties", hunterMap.get(bounty.userId), season);
			companyReceipt.guildName = modalSubmission.guild.name;

			hunterMap = await logicLayer.hunters.getCompanyHunterMap(origin.company.id);
			const currentCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
			if (previousCompanyLevel < currentCompanyLevel) {
				companyReceipt.levelUp = currentCompanyLevel;
			}
			const descendingRanks = await logicLayer.ranks.findAllRanks(origin.company.id);
			const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
			const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await modalSubmission.guild.roles.fetch());
			syncRankRoles(seasonalHunterReceipts, descendingRanks, modalSubmission.guild.members);
			consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);

			await modalSubmission.editReply({ content: rewardSummary("bounty", companyReceipt, hunterReceipts, origin.company.maxSimBounties) });

			const auditLogReason = auditReasonBountyComplete;
			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				refreshBountyBoardThread(modalSubmission.message, { title: strikethrough(bounty.title), embed: bountyEmbed(bounty, modalSubmission.member, hunterMap.get(bounty.userId).getLevel(origin.company.xpCoefficient), true, origin.company, new Set(validatedHunters.keys()), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents), goalProgress) }, auditLogReason);
				await unarchiveAndUnlockThread(modalSubmission.channel, auditLogReason);
			}
			modalSubmission.channel.edit({ archived: true, appliedTags: [origin.company.bountyBoardCompletedTagId], reason: auditLogReason });

			const announcementOptions = { content: `${userMention(bounty.userId)}'s bounty, ${modalSubmission.channel}, was completed!` };
			if (goalProgress.goalCompleted) {
				announcementOptions.embeds = [goalCompletionEmbed(goalProgress.contributorIds)];
			}
			modalSubmission.fields.getSelectedChannels(labelIdChannel).first().send(announcementOptions).catch(butIgnoreMissingPermissionErrors);
			if (origin.company.scoreboardIsSeasonal) {
				refreshReferenceChannelScoreboardSeasonal(origin.company, modalSubmission.guild, participationMap, descendingRanks, goalProgress);
			} else {
				refreshReferenceChannelScoreboardOverall(origin.company, modalSubmission.guild, hunterMap, goalProgress);
			}

			if (bounty.scheduledEventId) {
				modalSubmission.guild.scheduledEvents.delete(bounty.scheduledEventId).catch(butIgnoreErrorIf(isUnknownGuildScheduledEventError, isMissingPermissionError));
			}
		}
	)
);
