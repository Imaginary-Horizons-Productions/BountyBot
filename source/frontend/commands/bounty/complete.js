const { MessageFlags, userMention, channelMention, bold } = require("discord.js");
const { timeConversion } = require("../../../shared");
const { commandMention, fillableTextBar, bountyEmbed, rewardStringBountyCompletion, refreshReferenceChannelScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, generateCompletionEmbed, sendRewardMessage, companyLevelUpLine, formatHunterResultsToRewardTexts, reloadHunterMapSubset, syncRankRoles, formatSeasonResultsToRewardTexts, unarchiveAndUnlockThread } = require("../../shared");
const { SubcommandWrapper } = require("../../classes");
const { Company } = require("../../../database/models");

module.exports = new SubcommandWrapper("complete", "Close one of your open bounties, distributing rewards to hunters who turned it in",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const slotNumber = interaction.options.getInteger("bounty-slot");
		const bounty = await logicLayer.bounties.findBounty({ userId: interaction.user.id, slotNumber, companyId: interaction.guild.id });
		if (!bounty) {
			interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", flags: MessageFlags.Ephemeral });
			return;
		}

		// disallow completion within 5 minutes of creating bounty
		if (runMode === "production" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
			interaction.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty add-completers")} so you won't forget instead.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const completions = await logicLayer.bounties.findBountyCompletions(bounty.id);
		const hunterCollection = await interaction.guild.members.fetch({ user: completions.map(reciept => reciept.userId) });
		for (const optionKey of ["first-bounty-hunter", "second-bounty-hunter", "third-bounty-hunter", "fourth-bounty-hunter", "fifth-bounty-hunter"]) {
			const guildMember = interaction.options.getMember(optionKey);
			if (guildMember) {
				if (guildMember?.id !== interaction.user.id && !hunterCollection.has(guildMember.id)) {
					hunterCollection.set(guildMember.id, guildMember);
				}
			}
		}

		const validatedHunters = new Map();
		for (const [memberId, member] of hunterCollection) {
			if (runMode !== "production" || !member.user.bot) {
				const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, interaction.guild.id);
				if (!hunter.isBanned) {
					validatedHunters.set(memberId, hunter);
				}
			}
		}

		if (validatedHunters.size < 1) {
			interaction.reply({ content: `No bounty hunters have turn-ins recorded for this bounty. If you'd like to close your bounty without distributng rewards, use ${commandMention("bounty take-down")}.`, flags: MessageFlags.Ephemeral })
			return;
		}

		await interaction.deferReply();

		const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

		let hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
		const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
		const { completerXP, posterXP, hunterResults } = await logicLayer.bounties.completeBounty(bounty, origin.hunter, validatedHunters, season, origin.company);
		hunterMap = await reloadHunterMapSubset(hunterMap, [...validatedHunters.keys(), origin.hunter.userId]);
		const rewardTexts = formatHunterResultsToRewardTexts(hunterResults, hunterMap, origin.company);
		const companyLevelLine = companyLevelUpLine(origin.company, previousCompanyLevel, hunterMap, interaction.guild.name);
		if (companyLevelLine) {
			rewardTexts.push(companyLevelLine);
		}
		const goalUpdate = await logicLayer.goals.progressGoal(bounty.companyId, "bounties", origin.hunter, season);
		if (goalUpdate.gpContributed > 0) {
			rewardTexts.push(`This bounty contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
		}
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
		const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks);
		syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
		const rankUpdates = formatSeasonResultsToRewardTexts(seasonUpdates, descendingRanks, await interaction.guild.roles.fetch());
		const content = rewardStringBountyCompletion(validatedHunters.keys(), completerXP, bounty.userId, posterXP, origin.company.festivalMultiplierString(), rankUpdates, rewardTexts);

		bountyEmbed(bounty, interaction.guild, origin.hunter.getLevel(origin.company.xpCoefficient), true, origin.company, new Set([...validatedHunters.keys()])).then(async embed => {
			if (goalUpdate.gpContributed > 0) {
				const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guildId);
				if (goalId !== null) {
					embed.addFields({ name: "Server Goal", value: `${fillableTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
				} else {
					embed.addFields({ name: "Server Goal", value: `${fillableTextBar(15, 15, 15)} Completed!` });
				}
			}
			const acknowledgeOptions = { content: `${userMention(bounty.userId)}'s bounty, ` };
			if (goalUpdate.goalCompleted) {
				acknowledgeOptions.embeds = [generateCompletionEmbed(goalUpdate.contributorIds)];
			}

			if (origin.company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(origin.company.bountyBoardId);
				bountyBoard.threads.fetch(bounty.postingId).then(async thread => {
					await unarchiveAndUnlockThread(thread, "bounty complete");
					thread.setAppliedTags([origin.company.bountyBoardCompletedTagId]);
					thread.send({ content, flags: MessageFlags.SuppressNotifications });
					return thread.fetchStarterMessage();
				}).then(posting => {
					posting.edit({ embeds: [embed], components: [] }).then(() => {
						posting.channel.setArchived(true, "bounty completed");
					});
				});
				acknowledgeOptions.content += `${channelMention(bounty.postingId)}, was completed!`;
				interaction.editReply(acknowledgeOptions);
			} else {
				acknowledgeOptions.content += `${bold(bounty.title)}, was completed!`;
				interaction.editReply(acknowledgeOptions).then(message => {
					sendRewardMessage(message, content, `${bounty.title} Rewards`);
				})
			}

			const embeds = [];
			const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
			if (origin.company.scoreboardIsSeasonal) {
				embeds.push(await seasonalScoreboardEmbed(origin.company, interaction.guild, participationMap, descendingRanks, goalProgress));
			} else {
				embeds.push(await overallScoreboardEmbed(origin.company, interaction.guild, hunterMap, goalProgress));
			}
			refreshReferenceChannelScoreboard(origin.company, interaction.guild, embeds);
		});
	}
).setOptions(
	{
		type: "Integer",
		name: "bounty-slot",
		description: "The slot number of your bounty",
		required: true
	},
	{
		type: "User",
		name: "first-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "second-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "third-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "fourth-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "fifth-bounty-hunter",
		description: "A bounty hunter who completed the bounty",
		required: false
	}
);
