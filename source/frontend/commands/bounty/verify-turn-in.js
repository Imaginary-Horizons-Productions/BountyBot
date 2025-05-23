const { userMention, bold, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { listifyEN, commandMention, updatePosting, congratulationBuilder, disabledSelectRow, bountiesToSelectOptions } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require("../../../constants");

module.exports = new SubcommandWrapper("verify-turn-in", "Verify up to 5 bounty hunters have turned in one of your bounties",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, poster]) {
		const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: `You don't currently have any open bounties. Post one with ${commandMention("bounty post")}?`, flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: `Select one of your bounties and some bounty hunters who have turned it in. XP and drops will be distributed to those hunters when you use ${commandMention("bounty complete")}.`,
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}bounty`)
						.setPlaceholder("Select a bounty...")
						.addOptions(bountiesToSelectOptions(openBounties))
				),
				new ActionRowBuilder().addComponents(
					new UserSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
						.setPlaceholder("Select bounty hunters...")
						.setDisabled(true)
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message).then(message => {
			const collector = message.createMessageComponentCollector({ time: timeConversion(2, "m", "ms") });
			let bounty;
			collector.on("collect", async collectedInteraction => {
				const [_, stepId] = collectedInteraction.customId.split(SAFE_DELIMITER);
				switch (stepId) {
					case "bounty":
						bounty = openBounties.find(bounty => bounty.id === collectedInteraction.values[0]);
						collectedInteraction.update({
							components: [
								disabledSelectRow(bounty.title),
								new ActionRowBuilder().addComponents(
									new UserSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}hunters`)
										.setPlaceholder("Select bounty hunters...")
										.setMaxValues(5)
								)
							]
						});
						break;
					case "hunters":
						try {
							let { bounty: returnedBounty, allCompleters, company, validatedCompleterIds, bannedIds } = await logicLayer.bounties.addCompleters(bounty, interaction.guild, [...collectedInteraction.members.values()], runMode);
							const post = await updatePosting(collectedInteraction.guild, company, returnedBounty, poster.getLevel(company.xpCoefficient), allCompleters);
							const sentences = [];
							if (validatedCompleterIds.length > 0) {
								sentences.push(`The following bounty hunters' turn-ins of ${bold(returnedBounty.title)} have been recorded: ${listifyEN(validatedCompleterIds.map(id => userMention(id)))}`);
								if (post) {
									post.channel.send({ content: `${listifyEN(validatedCompleterIds.map(id => userMention(id)))} ${validatedCompleterIds.length === 1 ? "has" : "have"} turned in this bounty! ${congratulationBuilder()}!` });
								}
							}
							if (bannedIds.length > 0) {
								sentences.push(`The following users were skipped due to currently being banned from using BountyBot: ${listifyEN(bannedIds.map(id => userMention(id)))}`);
							}
							collectedInteraction.update({
								content: sentences.join("\n\n"),
								components: []
							});
						} catch (e) {
							if (typeof e !== 'string') {
								console.error(e);
							} else {
								collectedInteraction.update({ content: e, components: [] });
							}
							return;
						}
						break;
				}
			})
		})
	}
);
