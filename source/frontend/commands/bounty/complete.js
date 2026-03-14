const { MessageFlags, userMention, channelMention, bold, ModalBuilder, LabelBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder } = require("discord.js");
const { timeConversion } = require("../../../shared");
const { commandMention, bountyEmbed, goalCompletionEmbed, sendRewardMessage, syncRankRoles, unarchiveAndUnlockThread, rewardSummary, consolidateHunterReceipts, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, sentenceListEN, butIgnoreInteractionCollectorErrors, selectOptionsFromBounties } = require("../../shared");
const { SubcommandWrapper } = require("../../classes");
const { Company } = require("../../../database/models");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("complete", "Close one of your open bounties, distributing rewards to hunters who turned it in",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const openBounties = await logicLayer.bounties.findOpenBounties(origin.user.id, origin.company.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: "You don't appear to have any open bounties in this server.", flags: MessageFlags.Ephemeral });
			return;
		}

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
							.setOptions(selectOptionsFromBounties(openBounties))
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
		if (runMode === "production" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
			modalSubmission.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty record-turn-ins")} so you won't forget instead.`, flags: MessageFlags.Ephemeral });
			return;
		}

		// Early-out if no completers
		const completions = await logicLayer.bounties.findBountyCompletions(bounty.id);
		const memberCollection = await modalSubmission.guild.members.fetch({ user: completions.map(reciept => reciept.userId) });
		const validatedHunters = new Map();
		for (const [memberId, member] of memberCollection) {
			if (runMode !== "production" || !member.user.bot) {
				const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, origin.company.id);
				if (!hunter.isBanned) {
					validatedHunters.set(memberId, hunter);
				}
			}
		}

		const extraTurnIns = modalSubmission.fields.getSelectedMembers(labelIdBountyHunters);
		if (extraTurnIns !== null) {
			for (const [memberId, member] of extraTurnIns) {
				if (runMode !== "production" || !(member.user.bot || validatedHunters.has(memberId))) {
					const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, origin.company.id);
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

		let hunterMap = await logicLayer.hunters.getCompanyHunterMap(origin.company.id);

		const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
		const hunterReceipts = await logicLayer.bounties.completeBounty(bounty, origin.hunter, validatedHunters, season, origin.company);
		const { companyReceipt, goalProgress } = await logicLayer.goals.progressGoal(origin.company, "bounties", origin.hunter, season);
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
		const rewardMessageContent = rewardSummary("bounty", companyReceipt, hunterReceipts, origin.company.maxSimBounties);

		const acknowledgeOptions = { content: `${userMention(bounty.userId)}'s bounty, ` };
		if (goalProgress.goalCompleted) {
			acknowledgeOptions.embeds = [goalCompletionEmbed(goalProgress.contributorIds)];
		}

		if (origin.company.bountyBoardId) {
			acknowledgeOptions.content += `${channelMention(bounty.postingId)}, was completed!`;
			modalSubmission.editReply(acknowledgeOptions);
			const bountyBoard = await modalSubmission.guild.channels.fetch(origin.company.bountyBoardId);
			bountyBoard.threads.fetch(bounty.postingId).then(async thread => {
				await unarchiveAndUnlockThread(thread, "bounty complete");
				thread.setAppliedTags([origin.company.bountyBoardCompletedTagId]);
				thread.send({ content: rewardMessageContent, flags: MessageFlags.SuppressNotifications });
				return thread.fetchStarterMessage();
			}).then(async posting => {
				posting.edit({
					embeds: [bountyEmbed(bounty, modalSubmission.member, origin.hunter.getLevel(origin.company.xpCoefficient), true, origin.company, new Set([...validatedHunters.keys()]), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents), goalProgress)],
					components: []
				}).then(() => {
					posting.channel.setArchived(true, "bounty completed");
				});
			});
		} else {
			acknowledgeOptions.content += `${bold(bounty.title)}, was completed!`;
			modalSubmission.editReply(acknowledgeOptions).then(message => {
				sendRewardMessage(message, rewardMessageContent, `${bounty.title} Rewards`);
			})
		}

		if (origin.company.scoreboardIsSeasonal) {
			refreshReferenceChannelScoreboardSeasonal(origin.company, modalSubmission.guild, participationMap, descendingRanks, goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(origin.company, modalSubmission.guild, hunterMap, goalProgress);
		}
	}
);
