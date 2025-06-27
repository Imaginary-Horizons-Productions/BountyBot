const { userMention, bold, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { listifyEN, commandMention, updatePosting, congratulationBuilder, disabledSelectRow, bountiesToSelectOptions } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require("../../../constants");

module.exports = new SubcommandWrapper("record-turn-ins", "Record turn-ins of one of your bounties for up to 5 bounty hunters",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
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
						const { eligibleTurnInIds, newTurnInIds, bannedTurnInIds } = await logicLayer.bounties.checkTurnInEligibility(bounty, Array.from(collectedInteraction.members.values()), runMode);
						const sentences = [];
						if (bannedTurnInIds.size > 0) {
							sentences.push(`The following users were skipped due to currently being banned from using BountyBot: ${listifyEN(Array.from(bannedTurnInIds.values().map(id => userMention(id))))}`);
						}
						if (newTurnInIds.size < 1) {
							sentences.unshift("No new turn-ins were able to be recorded. You cannot credit yourself or bots for your own bounties.");
						} else {
							await logicLayer.bounties.bulkCreateCompletions(bounty.id, bounty.companyId, Array.from(eligibleTurnInIds), null);
							const newTurnInList = listifyEN(Array.from(newTurnInIds.values().map(id => userMention(id))));
							sentences.unshift(`Turn-ins of ${bold(bounty.title)} have been recorded for the following hunters: ${newTurnInList}`);
							const post = await updatePosting(collectedInteraction.guild, origin.company, bounty, origin.hunter.getLevel(origin.company.xpCoefficient), eligibleTurnInIds);
							if (post) {
								post.channel.send({ content: `${newTurnInList} ${newTurnInIds.size === 1 ? "has" : "have"} turned in this bounty! ${congratulationBuilder()}!` });
							}
						}

						collectedInteraction.update({
							content: sentences.join("\n\n"),
							components: []
						});
						break;
				}
			})
		})
	}
);
