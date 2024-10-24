const { MessageFlags, ActionRowBuilder, ChannelType, ChannelSelectMenuBuilder } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { MAX_MESSAGE_CONTENT_LENGTH, SKIP_INTERACTION_HANDLING } = require('../constants');
const { Bounty } = require('../models/bounties/Bounty');
const { updateScoreboard } = require('../util/embedUtil');
const { getRankUpdates } = require('../util/scoreUtil');
const { commandMention, timeConversion } = require('../util/textUtil');
const { rollItemDrop } = require('../util/itemUtil');
const { completeBounty } = require('../logic/bounties');
const { Hunter } = require('../models/users/Hunter');

const mainId = "bbcomplete";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId).then(async bounty => {
			await interaction.deferReply({ ephemeral: true });
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
					const rewardTexts = await completeBounty(bounty, poster, validatedHunters, collectedInteraction.guild, database);
					const rankUpdates = await getRankUpdates(collectedInteraction.guild, database);
					const multiplierString = company.festivalMultiplierString();
					let text = `__**XP Gained**__\n${validatedHunterIds.map(id => `<@${id}> + ${bountyBaseValue} XP${multiplierString}`).join("\n")}\n${collectedInteraction.member} + ${posterXP} XP${multiplierString}`;
					if (rankUpdates.length > 0) {
						text += `\n\n__**Rank Ups**__\n - ${rankUpdates.join("\n- ")}`;
					}
					if (rewardTexts.length > 0) {
						text += `\n\n__**Rewards**__\n - ${rewardTexts.join("\n- ")}`;
					}
					if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
						text = `Message overflow! Many people(?) probably gained many things(?).Use ${commandMention("stats")} to look things up.`;
					}

					if (collectedInteraction.channel.archived) {
						await collectedInteraction.channel.setArchived(false, "bounty complete");
					}
					collectedInteraction.channel.setAppliedTags([company.bountyBoardCompletedTagId]);
					collectedInteraction.reply({ content: text, flags: MessageFlags.SuppressNotifications });
					bounty.asEmbed(collectedInteraction.guild, poster.level, company.festivalMultiplierString(), true, database).then(embed => {
						interaction.message.edit({ embeds: [embed], components: [] });
						collectedInteraction.channel.setArchived(true, "bounty completed");
					})
					collectedInteraction.channels.first().send({ content: `<@${bounty.userId}>'s bounty, ${interaction.channel}, was completed!` }).catch(error => {
						//Ignore Missing Permissions errors, user selected channel bot cannot post in
						if (error.code !== 50013) {
							console.error(error);
						}
					});
					updateScoreboard(company, collectedInteraction.guild, database);
				})

				collector.on("end", () => {
					interaction.deleteReply();
				})
			});
		})
	}
);
