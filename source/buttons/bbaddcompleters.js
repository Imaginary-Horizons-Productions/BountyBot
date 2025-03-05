const { ActionRowBuilder, UserSelectMenuBuilder, userMention, DiscordjsErrorCodes, ComponentType, MessageFlags, Guild, ThreadChannel } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { listifyEN, congratulationBuilder, timeConversion } = require('../util/textUtil');
const { Completion } = require('../models/bounties/Completion.js');
const { Bounty } = require('../models/bounties/Bounty.js');
const { Company } = require('../models/companies/Company.js');
const { Hunter } = require('../models/users/Hunter.js');

/** @type {typeof import("../logic")} */
let logicLayer;

/**
 * Updates the board posting for the bounty after adding the completers
 * @param {Bounty} bounty
 * @param {Company} company
 * @param {Hunter} poster
 * @param {string[]} newCompleterIds
 * @param {Completion[]} completers
 * @param {Guild} guild
 * @param {ThreadChannel} btnPost
 */
async function updateBoardPosting(bounty, company, poster, newCompleterIds, completers, guild, btnPost) {
	if (!btnPost) return;
	if (btnPost.archived) {
		await btnPost.setArchived(false, "Unarchived to update posting");
	}
	btnPost.edit({ name: bounty.title });
	let numCompleters = newCompleterIds.length;
	btnPost.send({ content: `${listifyEN(newCompleterIds.map(id => userMention(id)))} ${numCompleters === 1 ? "has" : "have"} been added as ${numCompleters === 1 ? "a completer" : "completers"} of this bounty! ${congratulationBuilder()}!` });
	let starterMessage = await btnPost.fetchStarterMessage();
	starterMessage.edit({
		embeds: [await bounty.embed(guild, poster.level, false, company, completers)],
		components: bounty.generateBountyBoardButtons()
	});
}

const mainId = "bbaddcompleters";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can add completers.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			interaction.reply({
				content: "Which bounty hunters should be credited with completing the bounty?",
				components: [
					new ActionRowBuilder().addComponents(
						new UserSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
							.setPlaceholder("Select bounty hunters...")
							.setMaxValues(5)
					)
				],
				flags: [MessageFlags.Ephemeral],
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.UserSelect })).then(async collectedInteraction => {
				const validatedCompleterIds = [];
				const existingCompletions = await database.models.Completion.findAll({ where: { bountyId: bounty.id, companyId: collectedInteraction.guildId } });
				const existingCompleterIds = existingCompletions.map(completion => completion.userId);
				const bannedIds = [];
				for (const member of collectedInteraction.members.values().filter(member => !existingCompleterIds.includes(member.id))) {
					const memberId = member.id;
					if (memberId === interaction.user.id || (runMode === "production" && member.user.bot)) continue;
					const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(memberId, collectedInteraction.guild.id);
					if (hunter.isBanned) {
						bannedIds.push(memberId);
						continue;
					}
					existingCompleterIds.push(memberId);
					validatedCompleterIds.push(memberId);
				}

				if (validatedCompleterIds.length < 1) {
					return collectedInteraction.reply({ content: "Could not find any new non-bot completers.", flags: [MessageFlags.Ephemeral] });
				}

				let { bounty: returnedBounty, allCompleters, poster, company } = await logicLayer.bounties.addCompleters(collectedInteraction.guild, bounty, validatedCompleterIds);
				updateBoardPosting(returnedBounty, company, poster, validatedCompleterIds, allCompleters, collectedInteraction.guild, interaction.channel);
				return collectedInteraction.update({
					components: []
				});
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
