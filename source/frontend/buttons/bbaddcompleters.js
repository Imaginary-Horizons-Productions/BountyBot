const { ActionRowBuilder, UserSelectMenuBuilder, userMention, DiscordjsErrorCodes, ComponentType, MessageFlags, Guild, ThreadChannel } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants.js');
const { Bounty, Company, Completion, Hunter } = require('../../database/models');
const { timeConversion } = require('../../shared');
const { buildBountyEmbed, listifyEN, congratulationBuilder, generateBountyBoardButtons } = require('../shared');

/** @type {typeof import("../../logic")} */
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
		embeds: [await buildBountyEmbed(bounty, guild, poster.getLevel(company.xpCoefficient), false, company, completers)],
		components: generateBountyBoardButtons(bounty)
	});
}

const mainId = "bbaddcompleters";
module.exports = new ButtonWrapper(mainId, 3000,
	async (interaction, runMode, [bountyId]) => {
		const bounty = await logicLayer.bounties.findBounty(bountyId);
		if (!bounty) {
			interaction.reply({ content: "This bounty appears to no longer exist. Has this bounty already been completed?", flags: [MessageFlags.Ephemeral] })
		}
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
			try {
				let { bounty: returnedBounty, allCompleters, poster, company, validatedCompleterIds } = await logicLayer.bounties.addCompleters(bounty, collectedInteraction.guild, Array.from(collectedInteraction.members.values()), runMode);
				updateBoardPosting(returnedBounty, company, poster, validatedCompleterIds, allCompleters, collectedInteraction.guild, interaction.channel);
				return collectedInteraction.update({
					components: []
				});
			} catch (e) {
				if (typeof e !== 'string') {
					console.error(e);
				} else {
					collectedInteraction.reply({ content: e, flags: [MessageFlags.Ephemeral] });
				}
				return;
			}
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
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
