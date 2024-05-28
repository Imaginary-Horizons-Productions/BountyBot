const { ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { Op } = require('sequelize');

const mainId = "bbremovecompleters";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can remove completers.", ephemeral: true });
				return;
			}

			interaction.reply({
				content: "Which bounty hunters should be removed from bounty credit?",
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
					const removedIds = collectedInteraction.members.map((_, key) => key);
					database.models.Completion.destroy({ where: { bountyId: bounty.id, userId: { [Op.in]: removedIds } } });
					const poster = await database.models.Hunter.findOne({ where: { companyId: collectedInteraction.guildId, userId: collectedInteraction.user.id } });
					const company = await database.models.Company.findByPk(collectedInteraction.guildId);
					bounty.asEmbed(collectedInteraction.guild, poster.level, company.festivalMultiplierString(), false, database).then(async embed => {
						if (collectedInteraction.channel.archived) {
							await collectedInteraction.channel.setArchived(false, "completers removed from bounty");
						}
						interaction.message.edit({ embeds: [embed], components: bounty.generateBountyBoardButtons() })
					});

					collectedInteraction.reply({
						content: `The following bounty hunters have been removed as completers from **${bounty.title}**: <@${removedIds.join(">, ")}>`,
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
