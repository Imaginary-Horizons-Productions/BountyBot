const { ActionRowBuilder, StringSelectMenuBuilder, CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { getNumberEmoji } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require("../../constants");
const { Bounty } = require("../../models/bounties/Bounty");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] }).then(openBounties => {
		if (openBounties.length < 1) {
			interaction.reply({ content: "You don't seem to have any open bounties at the moment.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		interaction.reply({
			content: "Swapping a bounty to another slot will change the XP reward for that bounty.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}bounty`)
						.setPlaceholder("Select a bounty to swap...")
						.setMaxValues(1)
						.setOptions(bountiesToSelectOptions(openBounties))
				)
			],
			flags: [MessageFlags.Ephemeral],
			withResponse: true
		}).then(response => {
			const collector = response.resource.message.createMessageComponentCollector({ max: 2 });
			collector.on("collect", async (collectedInteraction) => {
				if (collectedInteraction.customId.endsWith("bounty")) {
					database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(async hunter => {
						const company = await database.models.Company.findByPk(interaction.guildId);
						if (hunter.maxSlots(company.maxSimBounties) < 2) {
							collectedInteraction.reply({ content: "You currently only have 1 bounty slot in this server.", flags: [MessageFlags.Ephemeral] });
							return;
						}

						const existingBounties = await database.models.Bounty.findAll({ where: { userId: interaction.user.id, companyId: interaction.guildId, state: "open" } });
						const previousBounty = existingBounties.find(bounty => bounty.id === collectedInteraction.values[0]);
						const slotOptions = [];
						for (let i = 1; i <= hunter.maxSlots(company.maxSimBounties); i++) {
							if (i != previousBounty.slotNumber) {
								const existingBounty = existingBounties.find(bounty => bounty.slotNumber == i);
								slotOptions.push(
									{
										emoji: getNumberEmoji(i),
										label: `Slot ${i}: ${existingBounty?.title ?? "Empty"}`,
										description: `XP Reward: ${Bounty.calculateCompleterReward(hunter.level, i, existingBounty?.showcaseCount ?? 0)}`,
										value: i.toString()
									}
								)
							}
						}

						collectedInteraction.update({
							content: "If there is a bounty in the destination slot, it'll be swapped to the old bounty's slot.",
							components: [
								new ActionRowBuilder().addComponents(
									new StringSelectMenuBuilder().setCustomId("disabled")
										.setPlaceholder(`Selected Bounty: ${previousBounty.title}`)
										.setDisabled(true)
										.addOptions([{ label: "placeholder", value: "placeholder" }])
								),
								new ActionRowBuilder().addComponents(
									new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}${SAFE_DELIMITER}${previousBounty.slotNumber}`)
										.setPlaceholder("Select a slot to swap the bounty to...")
										.setMaxValues(1)
										.setOptions(slotOptions)
								)
							],
							flags: [MessageFlags.Ephemeral]
						})
					})
				} else {
					const sourceSlot = parseInt(collectedInteraction.customId.split(SAFE_DELIMITER)[1]);
					const destinationSlot = parseInt(collectedInteraction.values[0]);
					const company = await database.models.Company.findByPk(interaction.guildId);

					const bounties = await database.models.Bounty.findAll({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber: { [Op.in]: [sourceSlot, destinationSlot] }, state: "open" } });
					const sourceBounty = bounties.find(bounty => bounty.slotNumber == sourceSlot);
					const destinationBounty = bounties.find(bounty => bounty.slotNumber == destinationSlot);
					sourceBounty.slotNumber = destinationSlot;
					await sourceBounty.save();
					await sourceBounty.reload();
					sourceBounty.updatePosting(interaction.guild, company, database);

					if (destinationBounty) {
						destinationBounty.slotNumber = sourceSlot;
						await destinationBounty.save();
						await destinationBounty.reload();
						destinationBounty.updatePosting(interaction.guild, company, database);
					}

					const hunter = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
					interaction.channel.send(company.sendAnnouncement({ content: `${interaction.member}'s bounty, **${sourceBounty.title}** is now worth ${Bounty.calculateCompleterReward(hunter.level, destinationSlot, sourceBounty.showcaseCount)} XP.` }));
				}
			})

			collector.on("end", () => {
				interaction.deleteReply();
			})
		})
	})
};

module.exports = {
	data: {
		name: "swap",
		description: "Move one of your bounties to another slot to change its reward"
	},
	executeSubcommand
};
