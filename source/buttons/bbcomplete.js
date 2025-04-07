const { MessageFlags, ActionRowBuilder, ChannelType, ChannelSelectMenuBuilder, userMention, ComponentType, DiscordjsErrorCodes } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { getRankUpdates } = require('../util/scoreUtil');
const { commandMention, timeConversion, generateTextBar } = require('../util/textUtil');
const { Bounty } = require('../models/bounties/Bounty');
const { Goal } = require('../models/companies/Goal');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "bbcomplete";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, runMode, [bountyId]) => {
		logicLayer.bounties.findBounty(bountyId).then(async bounty => {
			await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
			if (!bounty) {
				interaction.editReply({ content: "This bounty could not be found." });
				return;
			}

			if (bounty.userId !== interaction.user.id) {
				interaction.editReply({ content: "Only the bounty poster can mark a bounty completed." });
				return;
			}

			// Early-out if no completers
			const completions = await logicLayer.bounties.findBountyCompletions(bounty.id);
			const completerMembers = (await interaction.guild.members.fetch({ user: completions.map(reciept => reciept.userId) })).values();
			const validatedHunterIds = [];
			const validatedHunters = [];
			for (const member of completerMembers) {
				if (runMode !== "production" || !member.user.bot) {
					const memberId = member.id;
					const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(memberId, interaction.guild.id);
					if (!hunter.isBanned) {
						validatedHunterIds.push(memberId);
						validatedHunters.push(hunter);
					}
				}
			}

			if (validatedHunters.length < 1) {
				interaction.editReply({ content: `There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use ${commandMention("bounty take-down")}.` })
				return;
			}

			// disallow completion within 5 minutes of creating bounty
			if (runMode === "production" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
				interaction.editReply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty add-completers")} so you won't forget instead.` });
				return;
			}

			interaction.editReply({
				content: `Which channel should the bounty's completion be announced in?\n\nCompleters: <@${validatedHunterIds.join(">, <@")}>`,
				components: [
					new ActionRowBuilder().addComponents(
						new ChannelSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
							.setPlaceholder("Select channel...")
							.setChannelTypes(ChannelType.GuildText)
					)
				]
			}).then(message => message.awaitMessageComponent({ time: 120000, componentType: ComponentType.ChannelSelect })).then(async collectedInteraction => {
				const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

				const poster = await logicLayer.hunters.findOneHunter(bounty.userId, bounty.companyId);
				const { completerXP, posterXP, rewardTexts } = await logicLayer.bounties.completeBounty(bounty, poster, validatedHunters, await logicLayer.hunters.findCompanyHunters(collectedInteraction.guild.id), collectedInteraction.guild.name);
				const goalUpdate = await logicLayer.goals.progressGoal(bounty.companyId, "bounties", poster, season);
				if (goalUpdate.gpContributed > 0) {
					rewardTexts.push(`This bounty contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
				}
				const rankUpdates = await getRankUpdates(collectedInteraction.guild, logicLayer);

				if (collectedInteraction.channel.archived) {
					await collectedInteraction.channel.setArchived(false, "bounty complete");
				}
				const [company] = await logicLayer.companies.findOrCreateCompany(collectedInteraction.guildId);
				collectedInteraction.channel.setAppliedTags([company.bountyBoardCompletedTagId]);
				collectedInteraction.reply({ content: Bounty.generateRewardString(validatedHunterIds, completerXP, bounty.userId, posterXP, company.festivalMultiplierString(), rankUpdates, rewardTexts), flags: MessageFlags.SuppressNotifications });
				bounty.embed(collectedInteraction.guild, poster.getLevel(company.xpCoefficient), true, company, completions)
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
					announcementOptions.embeds = [Goal.generateCompletionEmbed(goalUpdate.contributorIds)];
				}
				collectedInteraction.channels.first().send(announcementOptions).catch(error => {
					//Ignore Missing Permissions errors, user selected channel bot cannot post in
					if (error.code !== 50013) {
						console.error(error);
					}
				});
				company.updateScoreboard(collectedInteraction.guild, logicLayer);
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
