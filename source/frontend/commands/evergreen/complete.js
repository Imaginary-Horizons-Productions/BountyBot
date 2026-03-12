const { MessageFlags, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, LabelBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { Bounty, Company } = require("../../../database/models");
const { bountyEmbed, goalCompletionEmbed, selectOptionsFromBounties, sendRewardMessage, syncRankRoles, refreshEvergreenBountiesThread, commandMention, rewardSummary, consolidateHunterReceipts, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { timeConversion } = require("../../../shared");

module.exports = new SubcommandWrapper("complete", "Distribute rewards for turn-ins of an evergreen bounty to up to 5 bounty hunters",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const evergreenBounties = await logicLayer.bounties.findEvergreenBounties(origin.company.id);
		if (evergreenBounties.length < 1) {
			interaction.reply({ content: `This server doesn't currently have any evergreen bounties. Post one with ${commandMention("evergreen post")}?`, flags: MessageFlags.Ephemeral });
			return;
		}

		const labelIdBountyId = "bounty-id";
		const labelIdBountyHunters = "bounty-hunters";
		const maxHunters = 10;
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Payout an Evergreen Bounty")
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select an evergreen bounty...")
							.setOptions(selectOptionsFromBounties(evergreenBounties))
					),
				new LabelBuilder().setLabel("Bounty Hunters")
					.setUserSelectMenuComponent(
						new UserSelectMenuBuilder().setCustomId(labelIdBountyHunters)
							.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
							.setMaxValues(maxHunters)
					)
			);
		await interaction.showModal(modal);
		const modalSubmission = await interaction.awaitModalSubmit({ filter: interaction => interaction.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
			.catch(butIgnoreInteractionCollectorErrors);
		if (!modalSubmission) {
			return;
		}

		const bountyId = modalSubmission.fields.getStringSelectValues(labelIdBountyId)[0];
		const bounty = await logicLayer.bounties.findBounty(bountyId);
		const validatedHunters = new Map();
		for (const [memberId, guildMember] of modalSubmission.fields.getSelectedMembers(labelIdBountyHunters)) {
			const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, origin.company.id);
			if (runMode !== "production" || (!guildMember.user.bot && !hunter.isBanned)) {
				validatedHunters.set(memberId, hunter);
			}
		}

		if (validatedHunters.size < 1) {
			modalSubmission.reply({ content: "No valid bounty hunters received. Bots cannot be credited for bounty completion.", flags: MessageFlags.Ephemeral })
			return;
		}

		const season = await logicLayer.seasons.incrementSeasonStat(origin.company.id, "bountiesCompleted");

		let hunterMap = await logicLayer.hunters.getCompanyHunterMap(origin.company.id);
		const companyReceipt = { guildName: modalSubmission.guild.name };
		const hunterReceipts = new Map();

		const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
		// Evergreen bounties are not eligible for showcase bonuses
		const bountyBaseValue = Bounty.calculateCompleterReward(previousCompanyLevel, bounty.slotNumber, 0);
		const bountyValue = Math.floor(bountyBaseValue * origin.company.xpFestivalMultiplier);
		await logicLayer.bounties.bulkCreateCompletions(bountyId, origin.company.id, [...validatedHunters.keys()], bountyValue);

		const xpMultiplierString = origin.company.festivalMultiplierString("xp");
		const goalProgress = {
			totalGP: 0,
			goalCompleted: false,
			currentGP: 0,
			requiredGP: 0
		};
		const finalContributorIds = new Set(validatedHunters.keys());
		for (const userId of validatedHunters.keys()) {
			const hunterReceipt = { xp: bountyBaseValue, xpMultiplier: xpMultiplierString };
			let hunter = await logicLayer.hunters.findOneHunter(userId, origin.company.id);
			const previousHunterLevel = hunter.getLevel(origin.company.xpCoefficient);
			hunter = await hunter.increment({ othersFinished: 1, xp: bountyValue }).then(hunter => hunter.reload());
			const currentHunterLevel = hunter.getLevel(origin.company.xpCoefficient);
			if (currentHunterLevel > previousHunterLevel) {
				hunterReceipt.levelUp = { achievedLevel: currentHunterLevel, previousLevel: previousHunterLevel };
			}
			hunterReceipts.set(userId, hunterReceipt);
			logicLayer.seasons.changeSeasonXP(userId, origin.company.id, season.id, bountyValue);
			const { goalProgress: { gpContributed, goalCompleted, contributorIds, currentGP, requiredGP } } = await logicLayer.goals.progressGoal(origin.company, "bounties", hunter, season);
			goalProgress.totalGP += gpContributed;
			goalProgress.goalCompleted ||= goalCompleted;
			goalProgress.currentGP = currentGP;
			goalProgress.requiredGP = requiredGP;
			contributorIds.forEach(id => finalContributorIds.add(id));
		}

		hunterMap = await logicLayer.hunters.getCompanyHunterMap(origin.company.id);
		const currentCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
		if (previousCompanyLevel < currentCompanyLevel) {
			companyReceipt.levelUp = currentCompanyLevel;
		}
		const announcementPayload = {
			embeds: [bountyEmbed(bounty, modalSubmission.guild.members.me, currentCompanyLevel, false, origin.company, finalContributorIds, null, goalProgress)],
			withResponse: true
		};
		if (goalProgress.totalGP > 0) {
			companyReceipt.gp = goalProgress.totalGP;
			companyReceipt.gpMultiplier = origin.company.festivalMultiplierString("gp");
		}
		if (goalProgress.goalCompleted) {
			announcementPayload.embeds.push(goalCompletionEmbed([...finalContributorIds.keys()]));
		}
		const response = await modalSubmission.reply(announcementPayload);
		const descendingRanks = await logicLayer.ranks.findAllRanks(origin.company.id);
		const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await modalSubmission.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, modalSubmission.guild.members);
		consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
		sendRewardMessage(response.resource.message, rewardSummary("bounty", companyReceipt, hunterReceipts, origin.company.maxSimBounties), `${bounty.title} Rewards`);
		if (origin.company.scoreboardIsSeasonal) {
			refreshReferenceChannelScoreboardSeasonal(origin.company, modalSubmission.guild, participationMap, descendingRanks, goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(origin.company, modalSubmission.guild, hunterMap, goalProgress);
		}
		if (origin.company.bountyBoardId) {
			const hunterIdMap = {};
			for (const bounty of evergreenBounties) {
				hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
			}
			const bountyBoard = await modalSubmission.guild.channels.fetch(origin.company.bountyBoardId);
			refreshEvergreenBountiesThread(bountyBoard, evergreenBounties, origin.company, currentCompanyLevel, modalSubmission.guild.members.me, hunterIdMap);
		} else if (!modalSubmission.member.manageable) {
			modalSubmission.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
		}
	}
);
