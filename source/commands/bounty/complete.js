const { MessageFlags, userMention, channelMention, bold } = require("discord.js");
const { Bounty } = require("../../models/bounties/Bounty");
const { extractUserIdsFromMentions, timeConversion, commandMention, generateTextBar } = require("../../util/textUtil");
const { getRankUpdates } = require("../../util/scoreUtil");
const { Goal } = require("../../models/companies/Goal");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("complete", "Close one of your open bounties, awarding XP to completers",
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
		const allCompleterIds = completions.map(reciept => reciept.userId);
		const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
		const completerIdsWithoutReciept = [];
		for (const id of mentionedIds) {
			if (!allCompleterIds.includes(id)) {
				allCompleterIds.push(id);
				completerIdsWithoutReciept.push(id);
			}
		}

		const completerMembers = allCompleterIds.length > 0 ? (await interaction.guild.members.fetch({ user: allCompleterIds })).values() : [];
		const validatedCompleterIds = [];
		const validatedHunters = [];
		for (const member of completerMembers) {
			if (runMode !== "production" || !member.user.bot) {
				const memberId = member.id;
				const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(memberId, interaction.guild.id);
				if (!hunter.isBanned) {
					validatedCompleterIds.push(memberId);
					validatedHunters.push(hunter);
				}
			}
		}

		if (validatedCompleterIds.length < 1) {
			interaction.reply({ content: `There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use ${commandMention("bounty take-down")}.`, flags: [MessageFlags.Ephemeral] })
			return;
		}

		await interaction.deferReply();

		const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

		const poster = await logicLayer.hunters.findOneHunter(bounty.userId, bounty.companyId);
		const { completerXP, posterXP, rewardTexts } = await logicLayer.bounties.completeBounty(bounty, poster, validatedHunters, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), interaction.guild.name);
		const goalUpdate = await logicLayer.goals.progressGoal(bounty.companyId, "bounties", poster, season);
		if (goalUpdate.gpContributed > 0) {
			rewardTexts.push(`This bounty contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
		}
		const rankUpdates = await getRankUpdates(interaction.guild, logicLayer);
		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guildId);
		const content = Bounty.generateRewardString(validatedCompleterIds, completerXP, bounty.userId, posterXP, company.festivalMultiplierString(), rankUpdates, rewardTexts);

		bounty.embed(interaction.guild, poster.getLevel(company.xpCoefficient), true, company.getThumbnailURLMap(), company.festivalMultiplierString(), completions).then(async embed => {
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
				acknowledgeOptions.embeds = [Goal.generateCompletionEmbed(goalUpdate.contributorIds)];
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
			if (company.scoreboardIsSeasonal) {
				embeds.push(await company.seasonalScoreboardEmbed(interaction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), await logicLayer.ranks.findAllRanks(interaction.guild.id)));
			} else {
				embeds.push(await company.overallScoreboardEmbed(interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), await logicLayer.ranks.findAllRanks(interaction.guild.id)));
			}
			company.updateScoreboard(interaction.guild, embeds);
		});
	}
).setOptions(
	{
		type: "Integer",
		name: "bounty-slot",
		description: "The slot number of the bounty to complete",
		required: true
	},
	{
		type: "String",
		name: "hunters",
		description: "The bounty hunter(s) to credit with completion",
		required: false
	}
);
