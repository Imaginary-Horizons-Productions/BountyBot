const { ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { commandMention, listifyEN, congratulationBuilder } = require('../util/textUtil');

const mainId = "bbaddcompleters";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can add completers.", ephemeral: true });
				return;
			}

			interaction.reply({
				content: "Which bounty hunters should be credited with completing the bounty?",
				components: [
					new ActionRowBuilder().addComponents(
						new UserSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}`)
							.setPlaceholder("Select bounty hunters...")
							.setMaxValues(5)
					)
				],
				fetchReply: true,
				ephemeral: true
			}).then(reply => {
				const collector = reply.createMessageComponentCollector({ max: 1 });

				collector.on("collect", async (collectedInteraction) => {
					const validatedCompleterIds = [];
					const existingCompletions = await database.models.Completion.findAll({ where: { bountyId: bounty.id, companyId: collectedInteraction.guildId } });
					const existingCompleterIds = existingCompletions.map(completion => completion.userId);
					const bannedIds = [];
					for (const member of collectedInteraction.members.values()) {
						const memberId = member.id;
						if (!existingCompleterIds.includes(memberId)) {
							await database.models.User.findOrCreate({ where: { id: memberId } });
							const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: memberId, companyId: collectedInteraction.guildId } });
							if (hunter.isBanned) {
								bannedIds.push(memberId);
								continue;
							}
							if (memberId !== interaction.user.id && (runMode !== "prod" || !member.user.bot)) {
								existingCompleterIds.push(memberId);
								validatedCompleterIds.push(memberId);
							}
						}
					}

					if (validatedCompleterIds.length < 1) {
						collectedInteraction.reply({ content: "Could not find any new non-bot completers.", ephemeral: true });
						return;
					}

					const rawCompletions = [];
					for (const userId of validatedCompleterIds) {
						rawCompletions.push({
							bountyId: bounty.id,
							userId,
							companyId: collectedInteraction.guildId
						})
					}
					database.models.Completion.bulkCreate(rawCompletions);
					const poster = await database.models.Hunter.findOne({ where: { companyId: collectedInteraction.guildId, userId: collectedInteraction.user.id } });
					const company = await database.models.Company.findByPk(collectedInteraction.guildId);
					bounty.asEmbed(collectedInteraction.guild, poster.level, company.festivalMultiplierString(), false, database).then(async embed => {
						if (collectedInteraction.channel.archived) {
							await collectedInteraction.channel.setArchived(false, "completers added to bounty");
						}
						interaction.message.edit({ embeds: [embed], components: bounty.generateBountyBoardButtons() })
					});

					collectedInteraction.channel.send({ content: `${listifyEN(validatedCompleterIds.map(id => `<@${id}>`))} ${validatedCompleterIds.length === 1 ? "has" : "have"} been added as ${validatedCompleterIds.length === 1 ? "a completer" : "completers"} of this bounty! ${congratulationBuilder()}!` });
					collectedInteraction.reply({
						content: `Completers have been added to **${bounty.title}**! They will recieve the reward XP when you ${commandMention("bounty complete")}.${bannedIds.length > 0 ? `\n\nThe following users were not added, due to currently being banned from using BountyBot: <@${bannedIds.join(">, ")}>` : ""}`,
						ephemeral: true
					});
				})

				collector.on("end", () => {
					interaction.deleteReply();
				})
			})
		})
	}
);
