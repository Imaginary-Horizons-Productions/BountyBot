const { MessageFlags, userMention, bold, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { listifyEN, updatePosting, selectOptionsFromBounties, disabledSelectRow, commandMention } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SAFE_DELIMITER, SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("revoke-turn-ins", "Revoke the turn-ins of up to 5 bounty hunters on one of your bounties",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: `You don't currently have any open bounties. Post one with ${commandMention("bounty post")}?`, flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: "Select one of your bounties and some bounty hunters whose turn-ins you'd like to revoke.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}bounty`)
						.setPlaceholder("Select Bounty...")
						.setOptions(selectOptionsFromBounties(openBounties))
				),
				disabledSelectRow("Select Bounty Hunters...")
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.createMessageComponentCollector({ time: timeConversion(2, "m", "ms") })).then(collector => {
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
						await logicLayer.bounties.deleteSelectedBountyCompletions(bounty.id, collectedInteraction.values);
						const post = await updatePosting(collectedInteraction.guild, origin.company, bounty, origin.hunter.getLevel(origin.company.xpCoefficient), await logicLayer.bounties.getHunterIdSet(bounty.id));
						if (post) {
							post.channel.send({ content: `${listifyEN(collectedInteraction.values.map(id => `<@${id}>`))} ${collectedInteraction.values.length === 1 ? "has had their turn-in" : "have had their turn-ins"} revoked.` });
						}

						collectedInteraction.update({ content: `These bounty hunters' turn-ins of ${bold(bounty.title)} have been revoked: ${listifyEN(collectedInteraction.values.map(id => userMention(id)))}`, components: [] });
						break;
				}
			})
		});
	}
);
