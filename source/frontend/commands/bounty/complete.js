const { MessageFlags, userMention, channelMention, bold } = require("discord.js");
const { timeConversion } = require("../../../shared");
const { commandMention, generateTextBar, getRankUpdates, buildBountyEmbed, generateBountyRewardString, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, generateCompletionEmbed } = require("../../shared");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("complete", "Close one of your open bounties, distributing rewards to hunters who turned it in",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, posterId]) {
		const slotNumber = interaction.options.getInteger("bounty-slot");
		const bounty = await logicLayer.bounties.findBounty({ userId: posterId, slotNumber, companyId: interaction.guild.id });
		if (!bounty) {
			interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		// disallow completion within 5 minutes of creating bounty
		if (runMode === "production" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
			interaction.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty add-completers")} so you won't forget instead.`, flags: [MessageFlags.Ephemeral] });
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

		const validatedHunterIds = [];
		const validatedHunters = [];
		for (const member of hunterCollection.values()) {
			if (runMode !== "production" || !member.user.bot) {
				const memberId = member.id;
				const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(memberId, interaction.guild.id);
				if (!hunter.isBanned) {
					validatedHunterIds.push(memberId);
					validatedHunters.push(hunter);
				}
			}
		}

		if (validatedHunterIds.length < 1) {
			interaction.reply({ content: `No bounty hunters have turn-ins recorded for this bounty. If you'd like to close your bounty without distributng rewards, use ${commandMention("bounty take-down")}.`, flags: [MessageFlags.Ephemeral] })
			return;
		}

		await interaction.deferReply();

		const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

		const poster = await logicLayer.hunters.findOneHunter(bounty.userId, bounty.companyId);
		const { completerXP, posterXP, rewardTexts, itemRollMap } = await logicLayer.bounties.completeBounty(bounty, poster, validatedHunters, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), interaction.guild.name);
		for (const hunterId of itemRollMap.hunters) {
			const hunter = validatedHunters.find(hunter => hunter.userId === hunterId);
			const [itemRow] = await logicLayer.items.rollItemForHunter(1 / 8, hunter);
			if (itemRow) {
				rewardTexts.push(`${userMention(hunterId)} has found a ${bold(itemRow.itemName)}`)
			}
		}
		for (const posterId of itemRollMap.poster) {
			const hunter = validatedHunters.find(hunter => hunter.userId === posterId);
			const [itemRow] = await logicLayer.items.rollItemForHunter(1 / 4, hunter);
			if (itemRow) {
				rewardTexts.push(`${userMention(posterId)} has found a ${bold(itemRow.itemName)}`)
			}
		}
		const goalUpdate = await logicLayer.goals.progressGoal(bounty.companyId, "bounties", poster, season);
		if (goalUpdate.gpContributed > 0) {
			rewardTexts.push(`This bounty contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
		}
		const rankUpdates = await getRankUpdates(interaction.guild, logicLayer);
		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guildId);
		const content = generateBountyRewardString(validatedHunterIds, completerXP, bounty.userId, posterXP, company.festivalMultiplierString(), rankUpdates, rewardTexts);

		buildBountyEmbed(bounty, interaction.guild, poster.getLevel(company.xpCoefficient), true, company, completions).then(async embed => {
			if (goalUpdate.gpContributed > 0) {
				const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guildId);
				if (goalId !== null) {
					embed.addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
				} else {
					embed.addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
				}
			}
			const acknowledgeOptions = { content: `${userMention(bounty.userId)}'s bounty, ` };
			if (goalUpdate.goalCompleted) {
				acknowledgeOptions.embeds = [generateCompletionEmbed(goalUpdate.contributorIds)];
			}

			if (company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
				bountyBoard.threads.fetch(bounty.postingId).then(async thread => {
					if (thread.archived) {
						await thread.setArchived(false, "bounty completed");
					}
					thread.setAppliedTags([company.bountyBoardCompletedTagId]);
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
					if (interaction.channel.isThread()) {
						interaction.channel.send({ content, flags: MessageFlags.SuppressNotifications });
					} else {
						message.startThread({ name: `${bounty.title} Rewards` }).then(thread => {
							thread.send({ content, flags: MessageFlags.SuppressNotifications });
						})
					}
				})
			}

			const embeds = [];
			const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
			if (company.scoreboardIsSeasonal) {
				embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), ranks));
			} else {
				embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), ranks));
			}
			updateScoreboard(company, interaction.guild, embeds);
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
