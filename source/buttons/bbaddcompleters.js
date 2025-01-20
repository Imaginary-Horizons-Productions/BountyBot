const { ActionRowBuilder, UserSelectMenuBuilder, userMention, bold } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { addCompleters } = require('../logic/bounties.js');
const { listifyEN, commandMention } = require('../util/textUtil');

/**
 * Updates the board posting for the bounty after adding the completers
 * @param {Bounty} bounty 
 * @param {Company} company 
 * @param {Hunter} poster 
 * @param {UserId[]} numCompleters 
 * @param {Guild} guild 
 */
async function updateBoardPosting(bounty, company, poster, newCompleterIds, completers, guild, btnChannel) {
	let { postingId } = bounty;
	if (!postingId) return;
	let post = await btnChannel.threads.fetch(postingId);
	if (post.archived) {
		await thread.setArchived(false, "Unarchived to update posting");
	}
	post.edit({ name: bounty.title });
	let numCompleters = newCompleterIds.length;
	post.send({ content: `${listifyEN(newCompleterIds.map(id => userMention(id)))} ${numCompleters === 1 ? "has" : "have"} been added as ${numCompleters === 1 ? "a completer" : "completers"} of this bounty! ${congratulationBuilder()}!` });
	let starterMessage = await post.fetchStarterMessage();
	starterMessage.edit({
		embeds: [await bounty.embed(guild, poster.level, company.festivalMultiplierString(), false, company, completers)],
		components: bounty.generateBountyBoardButtons()
	});
}

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

					let {bounty: returnedBounty, allCompleters, poster, company} = await addCompleters(collectedInteraction.guild, bounty, validatedCompleterIds);
					updateBoardPosting(returnedBounty, company, poster, validatedCompleterIds, allCompleters, collectedInteraction.guild, interaction.channel);
					collectedInteraction.reply({
						content: `The following bounty hunters have been added as completers to ${bold(bounty.title)}: ${listifyEN(validatedCompleterIds.map(id => userMention(id)))}\n\nThey will recieve the reward XP when you ${commandMention("bounty complete")}.${bannedIds.length > 0 ? `\n\nThe following users were not added, due to currently being banned from using BountyBot: ${listifyEN(bannedIds.map(id => userMention(id)))}` : ""}`,
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

module.exports.setLogic = (logicBundle) => {
	bounties = logicBundle.bounties;
}
