const { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { Bounty } = require("../../../database/models");
const { getRankUpdates, generateTextBar, buildBountyEmbed, generateBountyRewardString, buildCompanyLevelUpLine, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, buildHunterLevelUpLine, generateCompletionEmbed, disabledSelectRow, bountiesToSelectOptions, sendToRewardsThread } = require("../../shared");
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require("../../../constants");
const { timeConversion } = require("../../../shared");

module.exports = new SubcommandWrapper("complete", "Distribute rewards for turn-ins of an evergreen bounty to up to 5 bounty hunters",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
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
						const company = await logicLayer.companies.findCompanyByPK(collectedInteraction.guild.id);
						const validatedHunterIds = [];
						for (const guildMember of collectedInteraction.members.values()) {
							const hunter = await logicLayer.hunters.findOrCreateBountyHunter(guildMember.id, guildMember.guild.id);
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
						const previousCompanyLevel = company.getLevel(allHunters);
						// Evergreen bounties are not eligible for showcase bonuses
						const bountyBaseValue = Bounty.calculateCompleterReward(previousCompanyLevel, bounty.slotNumber, 0);
						const bountyValue = Math.floor(bountyBaseValue * company.festivalMultiplier);
						const completions = await logicLayer.bounties.bulkCreateCompletions(bounty.id, collectedInteraction.guild.id, validatedHunterIds, bountyValue);

						const levelTexts = [];
						let totalGP = 0;
						let wasGoalCompleted = false;
						const finalContributorIds = new Set(validatedHunterIds);
						for (const userId of validatedHunterIds) {
							const hunter = await logicLayer.hunters.findOneHunter(userId, collectedInteraction.guild.id);
							const previousHunterLevel = hunter.getLevel(company.xpCoefficient);
							await hunter.increment({ othersFinished: 1, xp: bountyValue }).then(hunter => hunter.reload());
							const levelLine = buildHunterLevelUpLine(hunter, previousHunterLevel, company.xpCoefficient, company.maxSimBounties);
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
							if (validatedHunterIds.includes(hunter.userId)) {
								return hunter.reload();
							} else {
								return hunter;
							}
						}))
						const companyLevelLine = buildCompanyLevelUpLine(company, previousCompanyLevel, reloadedHunters, collectedInteraction.guild.name);
						if (companyLevelLine) {
							levelTexts.push(companyLevelLine);
						}
						buildBountyEmbed(bounty, collectedInteraction.guild, company.getLevel(allHunters), true, company, completions).then(async embed => {
							const announcementPayload = { embeds: [embed], withResponse: true };
							if (totalGP > 0) {
								levelTexts.push(`This bounty contributed ${totalGP} GP to the Server Goal!`);
								const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(collectedInteraction.guildId);
								if (goalId !== null) {
									embed.addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
								} else {
									embed.addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
								}
							}
							if (wasGoalCompleted) {
								announcementPayload.embeds.push(generateCompletionEmbed([...finalContributorIds.keys()]));
							}
							await collectedInteraction.update({ components: [] });
							interaction.deleteReply();
							return collectedInteraction.channel.send(announcementPayload);
						}).then(message => {
							getRankUpdates(collectedInteraction.guild, logicLayer).then(async rankUpdates => {
								sendToRewardsThread(message, generateBountyRewardString(validatedHunterIds, bountyBaseValue, null, null, company.festivalMultiplierString(), rankUpdates, levelTexts), `${bounty.title} Rewards`);
								const embeds = [];
								const ranks = await logicLayer.ranks.findAllRanks(collectedInteraction.guild.id);
								const goalProgress = await logicLayer.goals.findLatestGoalProgress(collectedInteraction.guild.id);
								if (company.scoreboardIsSeasonal) {
									embeds.push(await seasonalScoreboardEmbed(company, collectedInteraction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), ranks, goalProgress));
								} else {
									embeds.push(await overallScoreboardEmbed(company, collectedInteraction.guild, await logicLayer.hunters.findCompanyHunters(collectedInteraction.guild.id), ranks, goalProgress));
								}
								updateScoreboard(company, collectedInteraction.guild, embeds);
							});
						})
						break;
				}
			})
		})
	}
);
