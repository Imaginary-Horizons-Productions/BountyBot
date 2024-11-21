const { ActionRowBuilder, UserSelectMenuBuilder, userMention, bold } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { addCompleters } = require('../logic/bounties.js');

const mainId = "bbaddcompleters";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
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

					addCompleters(collectedInteraction.guild, database, bounty, bounty.Company, validatedCompleterIds);
					collectedInteraction.update({
						components: []
					});
				})

				collector.on("end", () => {
					interaction.deleteReply();
				})
			})
		})
	}
);
