const { MessageFlags, ActionRowBuilder, ChannelType, ChannelSelectMenuBuilder, userMention, ComponentType, DiscordjsErrorCodes } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { commandMention, generateTextBar, buildBountyEmbed, generateBountyRewardString, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, generateCompletionEmbed, buildCompanyLevelUpLine, formatHunterResultsToRewardTexts, reloadHunterMapSubset, syncRankRoles, formatSeasonResultsToRewardTexts, listifyEN } = require('../shared');
const { timeConversion } = require('../../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "bbcomplete";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, origin, runMode, [bountyId]) => {
		logicLayer.bounties.findBounty(bountyId).then(async bounty => {
			if (!bounty) {
				interaction.reply({ content: "This bounty could not be found.", flags: MessageFlags.Ephemeral });
				return;
			}

			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can mark a bounty completed.", flags: MessageFlags.Ephemeral });
				return;
			}

			// Early-out if no completers
			const completions = await logicLayer.bounties.findBountyCompletions(bounty.id);
			const hunterCollection = await interaction.guild.members.fetch({ user: completions.map(reciept => reciept.userId) });
			const validatedHunterIds = [];
			const validatedHunters = [];
			for (const member of hunterCollection.values()) {
				if (runMode !== "production" || !member.user.bot) {
					const memberId = member.id;
					const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, interaction.guild.id);
					if (!hunter.isBanned) {
						validatedHunterIds.push(memberId);
						validatedHunters.push(hunter);
					}
				}
			}

			if (validatedHunters.length < 1) {
				interaction.reply({ content: `There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use ${commandMention("bounty take-down")}.`, flags: MessageFlags.Ephemeral })
				return;
			}

			// disallow completion within 5 minutes of creating bounty
			if (runMode === "production" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
				interaction.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty add-completers")} so you won't forget instead.`, flags: MessageFlags.Ephemeral });
				return;
			}

			const hunterIdSet = new Set(validatedHunterIds);
			interaction.reply({
				content: `Which channel should the bounty's completion be announced in?\n\nPending Turn-Ins: ${listifyEN(hunterIdSet.values().map(id => userMention(id)))}`,
				components: [
					new ActionRowBuilder().addComponents(
						new ChannelSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
							.setPlaceholder("Select channel...")
							.setChannelTypes(ChannelType.GuildText)
					)
				],
				flags: MessageFlags.Ephemeral,
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.ChannelSelect })).then(async collectedInteraction => {
				await collectedInteraction.deferReply({ flags: MessageFlags.SuppressNotifications });
				const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

				let hunterMap = await logicLayer.hunters.getCompanyHunterMap(collectedInteraction.guild.id);
				const previousCompanyLevel = origin.company.getLevel(Object.values(hunterMap));
				const { completerXP, posterXP, hunterResults } = await logicLayer.bounties.completeBounty(bounty, hunterMap[bounty.userId], validatedHunters, season, origin.company);
				hunterMap = await reloadHunterMapSubset(hunterMap, validatedHunterIds.concat(bounty.userId));
				const rewardTexts = formatHunterResultsToRewardTexts(hunterResults, hunterMap, origin.company);
				const companyLevelLine = buildCompanyLevelUpLine(origin.company, previousCompanyLevel, Object.values(hunterMap), collectedInteraction.guild.name);
				if (companyLevelLine) {
					rewardTexts.push(companyLevelLine);
				}
				const goalUpdate = await logicLayer.goals.progressGoal(bounty.companyId, "bounties", hunterMap[bounty.userId], season);
				if (goalUpdate.gpContributed > 0) {
					rewardTexts.push(`This bounty contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
				}
				const descendingRanks = await logicLayer.ranks.findAllRanks(collectedInteraction.guild.id);
				const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
				const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks);
				syncRankRoles(seasonUpdates, descendingRanks, collectedInteraction.guild.members);
				const rankUpdates = formatSeasonResultsToRewardTexts(seasonUpdates, descendingRanks, await collectedInteraction.guild.roles.fetch());

				if (collectedInteraction.channel.archived) {
					await collectedInteraction.channel.setArchived(false, "bounty complete");
				}
				collectedInteraction.channel.setAppliedTags([origin.company.bountyBoardCompletedTagId]);
				collectedInteraction.editReply({ content: generateBountyRewardString(validatedHunterIds, completerXP, bounty.userId, posterXP, origin.company.festivalMultiplierString(), rankUpdates, rewardTexts) });
				buildBountyEmbed(bounty, collectedInteraction.guild, hunterMap[bounty.userId].getLevel(origin.company.xpCoefficient), true, origin.company, hunterIdSet)
					.then(async embed => {
						if (goalUpdate.gpContributed > 0) {
							const { goalId, requiredGP, currentGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guildId);
							if (goalId !== null) {
								embed.addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
							} else {
								embed.addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
							}
						}
						interaction.message.edit({ embeds: [embed], components: [] });
						collectedInteraction.channel.setArchived(true, "bounty completed");
					})
				const announcementOptions = { content: `${userMention(bounty.userId)}'s bounty, ${interaction.channel}, was completed!` };
				if (goalUpdate.goalCompleted) {
					announcementOptions.embeds = [generateCompletionEmbed(goalUpdate.contributorIds)];
				}
				collectedInteraction.channels.first().send(announcementOptions).catch(error => {
					//Ignore Missing Permissions errors, user selected channel bot cannot post in
					if (error.code !== 50013) {
						console.error(error);
					}
				});
				const embeds = [];
				const goalProgress = await logicLayer.goals.findLatestGoalProgress(collectedInteraction.guild.id);
				if (origin.company.scoreboardIsSeasonal) {
					embeds.push(await seasonalScoreboardEmbed(origin.company, collectedInteraction.guild, participationMap, descendingRanks, goalProgress));
				} else {
					embeds.push(await overallScoreboardEmbed(origin.company, collectedInteraction.guild, await logicLayer.hunters.findCompanyHunters(collectedInteraction.guild.id), goalProgress));
				}
				updateScoreboard(origin.company, collectedInteraction.guild, embeds);
			}).catch(error => {
				if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
					console.error(error);
				}
			}).finally(() => {
				// If the bounty thread was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
				if (interaction.channel) {
					interaction.deleteReply();
				}
			});
		})
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
