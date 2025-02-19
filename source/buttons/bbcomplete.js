const { MessageFlags, ActionRowBuilder, ChannelType, ChannelSelectMenuBuilder, EmbedBuilder, userMention, ComponentType, DiscordjsErrorCodes } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { updateScoreboard } = require('../util/embedUtil');
const { getRankUpdates } = require('../util/scoreUtil');
const { commandMention, timeConversion, congratulationBuilder, listifyEN, generateTextBar } = require('../util/textUtil');
const { completeBounty } = require('../logic/bounties');
const { Hunter } = require('../models/users/Hunter');
const { findLatestGoalProgress } = require('../logic/goals');
const { Bounty } = require('../models/bounties/Bounty');
const { findOrCreateCompany } = require('../logic/companies');

const mainId = "bbcomplete";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId).then(async bounty => {
			if (!bounty) {
				interaction.reply({ content: "This bounty could not be found.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
			if (bounty.userId !== interaction.user.id) {
				interaction.editReply({ content: "Only the bounty poster can mark a bounty completed." });
				return;
			}

			// Early-out if no completers
			const completions = await database.models.Completion.findAll({ where: { bountyId: bounty.id } });
			const completerMembers = (await interaction.guild.members.fetch({ user: completions.map(reciept => reciept.userId) })).values();
			const validatedHunterIds = [];
			const validatedHunters = [];
			for (const member of completerMembers) {
				if (runMode !== "prod" || !member.user.bot) {
					const memberId = member.id;
					await database.models.User.findOrCreate({ where: { id: memberId } });
					const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: memberId, companyId: interaction.guildId } });
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
			if (runMode === "prod" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
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
				/** @type {Hunter} */
				const poster = await database.models.Hunter.findOne({ where: { userId: bounty.userId, companyId: bounty.companyId } });
				const { completerXP, posterXP, rewardTexts, goalUpdate } = await completeBounty(bounty, poster, validatedHunters, collectedInteraction.guild);
				const rankUpdates = await getRankUpdates(collectedInteraction.guild, database);

				if (collectedInteraction.channel.archived) {
					await collectedInteraction.channel.setArchived(false, "bounty complete");
				}
				const [company] = await findOrCreateCompany(collectedInteraction.guildId);
				collectedInteraction.channel.setAppliedTags([company.bountyBoardCompletedTagId]);
				collectedInteraction.reply({ content: Bounty.generateRewardString(validatedHunterIds, completerXP, bounty.userId, posterXP, company.festivalMultiplierString(), rankUpdates, rewardTexts), flags: MessageFlags.SuppressNotifications });
				bounty.embed(collectedInteraction.guild, poster.level, true, company, completions)
					.then(async embed => {
						if (goalUpdate.gpContributed > 0) {
							const { goalId, requiredGP, currentGP } = await findLatestGoalProgress(interaction.guildId);
							if (goalId !== null) {
								embed.addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${Math.min(currentGP, requiredGP)}/${requiredGP} GP` });
							} else {
								embed.addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
							}

						}
						interaction.message.edit({ embeds: [embed], components: [] });
						collectedInteraction.channel.setArchived(true, "bounty completed");
					})
				const announcementOptions = { content: `${userMention(bounty.userId)}'s bounty, ${interaction.channel}, was completed!` };
				if (goalUpdate.goalCompleted) {
					announcementOptions.embeds = [
						new EmbedBuilder().setColor("e5b271")
							.setTitle("Server Goal Completed")
							.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
							.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
							.addFields({ name: "Contributors", value: listifyEN(goalUpdate.contributorIds.map(id => userMention(id))) })
					];
				}
				collectedInteraction.channels.first().send(announcementOptions).catch(error => {
					//Ignore Missing Permissions errors, user selected channel bot cannot post in
					if (error.code !== 50013) {
						console.error(error);
					}
				});
				updateScoreboard(company, collectedInteraction.guild, database);
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
);
