const { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { Bounty } = require("../../../database/models");
const { generateTextBar, buildBountyEmbed, generateBountyRewardString, buildCompanyLevelUpLine, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, buildHunterLevelUpLine, generateCompletionEmbed, disabledSelectRow, bountiesToSelectOptions, sendToRewardsThread, syncRankRoles, formatSeasonResultsToRewardTexts, updateEvergreenBountyBoard, commandMention } = require("../../shared");
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require("../../../constants");
const { timeConversion } = require("../../../shared");

module.exports = new SubcommandWrapper("complete", "Distribute rewards for turn-ins of an evergreen bounty to up to 5 bounty hunters",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const evergreenBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		if (evergreenBounties.length < 1) {
			interaction.reply({ content: `This server doesn't currently have any evergreen bounties. Post one with ${commandMention("evergreen post")}?`, flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: "Select an evergreen bounty and some bounty hunters to distribute its rewards to.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}bounty`)
						.setPlaceholder("Select bounty...")
						.setOptions(bountiesToSelectOptions(evergreenBounties))
				),
				disabledSelectRow("Select bounty hunters...")
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.createMessageComponentCollector({ time: timeConversion(2, "m", "ms") })).then(collector => {
			let bounty;
			collector.on("collect", async collectedInteraction => {
				const [_, stepId] = collectedInteraction.customId.split(SAFE_DELIMITER);
				switch (stepId) {
					case "bounty":
						bounty = evergreenBounties.find(bounty => bounty.id === collectedInteraction.values[0]);
						collectedInteraction.update({
							components: [
								disabledSelectRow(`Selected Bounty: ${bounty.title}`),
								new ActionRowBuilder().addComponents(
									new UserSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}hunters`)
										.setPlaceholder("Select bounty hunters...")
										.setMaxValues(5)
								)
							]
						});
						break;
					case "hunters":
						const validatedHunterIds = [];
						for (const guildMember of collectedInteraction.members.values()) {
							const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(guildMember.id, guildMember.guild.id);
							if (runMode !== "production" || (!guildMember.user.bot && !hunter.isBanned)) {
								validatedHunterIds.push(guildMember.id);
							}
						}

						if (validatedHunterIds.length < 1) {
							collectedInteraction.reply({ content: "No valid bounty hunters received. Bots cannot be credited for bounty completion.", flags: MessageFlags.Ephemeral })
							return;
						}

						const season = await logicLayer.seasons.incrementSeasonStat(collectedInteraction.guild.id, "bountiesCompleted");

						const allHunters = await logicLayer.hunters.findCompanyHunters(collectedInteraction.guild.id);
						const previousCompanyLevel = origin.company.getLevel(allHunters);
						// Evergreen bounties are not eligible for showcase bonuses
						const bountyBaseValue = Bounty.calculateCompleterReward(previousCompanyLevel, bounty.slotNumber, 0);
						const bountyValue = Math.floor(bountyBaseValue * origin.company.festivalMultiplier);
						await logicLayer.bounties.bulkCreateCompletions(bounty.id, collectedInteraction.guild.id, validatedHunterIds, bountyValue);

						const levelTexts = [];
						let totalGP = 0;
						let wasGoalCompleted = false;
						const finalContributorIds = new Set(validatedHunterIds);
						for (const userId of validatedHunterIds) {
							const hunter = await logicLayer.hunters.findOneHunter(userId, collectedInteraction.guild.id);
							const previousHunterLevel = hunter.getLevel(origin.company.xpCoefficient);
							await hunter.increment({ othersFinished: 1, xp: bountyValue }).then(hunter => hunter.reload());
							const levelLine = buildHunterLevelUpLine(hunter, previousHunterLevel, origin.company.xpCoefficient, origin.company.maxSimBounties);
							if (levelLine) {
								levelTexts.push(levelLine);
							}
							logicLayer.seasons.changeSeasonXP(userId, collectedInteraction.guildId, season.id, bountyValue);
							const { gpContributed, goalCompleted, contributorIds } = await logicLayer.goals.progressGoal(collectedInteraction.guildId, "bounties", hunter, season);
							totalGP += gpContributed;
							wasGoalCompleted ||= goalCompleted;
							contributorIds.forEach(id => finalContributorIds.add(id));
						}

						const reloadedHunters = await Promise.all(allHunters.map(hunter => {
							if (finalContributorIds.has(hunter.userId)) {
								return hunter.reload();
							} else {
								return hunter;
							}
						}))
						const companyLevelLine = buildCompanyLevelUpLine(origin.company, previousCompanyLevel, reloadedHunters, collectedInteraction.guild.name);
						if (companyLevelLine) {
							levelTexts.push(companyLevelLine);
						}
						const currentCompanyLevel = origin.company.getLevel(allHunters);
						const completedBountyEmbed = await buildBountyEmbed(bounty, collectedInteraction.guild, currentCompanyLevel, false, origin.company, finalContributorIds);
						const announcementPayload = { embeds: [completedBountyEmbed], withResponse: true };
						if (totalGP > 0) {
							levelTexts.push(`This bounty contributed ${totalGP} GP to the Server Goal!`);
							const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(collectedInteraction.guildId);
							if (goalId !== null) {
								completedBountyEmbed.addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
							} else {
								completedBountyEmbed.addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
							}
						}
						if (wasGoalCompleted) {
							announcementPayload.embeds.push(generateCompletionEmbed([...finalContributorIds.keys()]));
						}
						await collectedInteraction.update({ components: [] });
						interaction.deleteReply();
						const message = await collectedInteraction.channel.send(announcementPayload);
						const descendingRanks = await logicLayer.ranks.findAllRanks(collectedInteraction.guild.id);
						const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
						const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks);
						syncRankRoles(seasonUpdates, descendingRanks, collectedInteraction.guild.members);
						sendToRewardsThread(message, generateBountyRewardString(validatedHunterIds, bountyBaseValue, null, null, origin.company.festivalMultiplierString(), formatSeasonResultsToRewardTexts(seasonUpdates, descendingRanks, await collectedInteraction.guild.roles.fetch()), levelTexts), `${bounty.title} Rewards`);
						const embeds = [];
						const goalProgress = await logicLayer.goals.findLatestGoalProgress(collectedInteraction.guild.id);
						if (origin.company.scoreboardIsSeasonal) {
							embeds.push(await seasonalScoreboardEmbed(origin.company, collectedInteraction.guild, participationMap, descendingRanks, goalProgress));
						} else {
							embeds.push(await overallScoreboardEmbed(origin.company, collectedInteraction.guild, await logicLayer.hunters.findCompanyHunters(collectedInteraction.guild.id), goalProgress));
						}
						updateScoreboard(origin.company, collectedInteraction.guild, embeds);
						if (origin.company.bountyBoardId) {
							const hunterIdMap = {};
							for (const bounty of evergreenBounties) {
								hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
							}
							const bountyBoard = await collectedInteraction.guild.channels.fetch(origin.company.bountyBoardId);
							updateEvergreenBountyBoard(bountyBoard, evergreenBounties, origin.company, currentCompanyLevel, collectedInteraction.guild, hunterIdMap);
						} else if (!collectedInteraction.member.manageable) {
							collectedInteraction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
						}
						break;
				}
			})
		})
	}
);
