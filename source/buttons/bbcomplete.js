const { MessageFlags, ActionRowBuilder, ChannelType, ChannelSelectMenuBuilder, EmbedBuilder, userMention } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { MAX_MESSAGE_CONTENT_LENGTH, SKIP_INTERACTION_HANDLING } = require('../constants');
const { updateScoreboard } = require('../util/embedUtil');
const { getRankUpdates } = require('../util/scoreUtil');
const { commandMention, timeConversion, congratulationBuilder, listifyEN, generateTextBar } = require('../util/textUtil');
const { completeBounty } = require('../logic/bounties');
const { Hunter } = require('../models/users/Hunter');

const mainId = "bbcomplete";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
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
			const completerIds = (await database.models.Completion.findAll({ where: { bountyId: bounty.id } })).map(reciept => reciept.userId);
			const completerMembers = (await interaction.guild.members.fetch({ user: completerIds })).values();
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
			}).then(reply => {
				const collector = reply.createMessageComponentCollector({ max: 1 });

				collector.on("collect", async collectedInteraction => {
					/** @type {Hunter} */
					const poster = await database.models.Hunter.findOne({ where: { userId: bounty.userId, companyId: bounty.companyId } });
					let [text, rewardTexts, goalProgress] = await completeBounty(bounty, poster, validatedHunters, collectedInteraction.guild, database);
					const rankUpdates = await getRankUpdates(collectedInteraction.guild, database);
					if (rankUpdates.length > 0) {
						text += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
					}
					if (rewardTexts.length > 0) {
						text += `\n\n__**Rewards**__\n- ${rewardTexts.join("\n- ")}`;
					}
					if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
						text = `Message overflow! Many people(?) probably gained many things(?).Use ${commandMention("stats")} to look things up.`;
					}

					if (collectedInteraction.channel.archived) {
						await collectedInteraction.channel.setArchived(false, "bounty complete");
					}
					collectedInteraction.channel.setAppliedTags([bounty.Company.bountyBoardCompletedTagId]);
					collectedInteraction.reply({ content: text, flags: MessageFlags.SuppressNotifications });
					bounty.asEmbed(collectedInteraction.guild, poster.level, bounty.Company.festivalMultiplierString(), true, database).then(async embed => {
						if (goalProgress.gpContributed > 0) {
							const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId } });
							const progress = await database.models.Contribution.sum("value", { where: { goalId: goal.id } });
							embed.addFields({ name: "Server Goal", value: `${generateTextBar(progress, goal.requiredContributions, 15)} ${Math.min(progress, goal.requiredContributions)}/${goal.requiredContributions} GP` });
						}
						interaction.message.edit({ embeds: [embed], components: [] });
						collectedInteraction.channel.setArchived(true, "bounty completed");
					})
					const announcementOptions = { content: `${userMention(bounty.userId)}'s bounty, ${interaction.channel}, was completed!` };
					if (goalProgress.goalCompleted) {
						announcementOptions.embeds = [
							new EmbedBuilder().setColor("e5b271")
								.setTitle("Server Goal Completed")
								.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
								.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
								.addFields({ name: "Contributors", value: listifyEN(goalProgress.contributorIds.map(id => userMention(id))) })
						];
					}
					collectedInteraction.channels.first().send(announcementOptions).catch(error => {
						//Ignore Missing Permissions errors, user selected channel bot cannot post in
						if (error.code !== 50013) {
							console.error(error);
						}
					});
					updateScoreboard(bounty.Company, collectedInteraction.guild, database);
				})

				collector.on("end", () => {
					interaction.deleteReply();
				})
			});
		})
	}
);
