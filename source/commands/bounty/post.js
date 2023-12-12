const { ActionRowBuilder, StringSelectMenuBuilder, CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Bounty } = require("../../models/bounties/Bounty");
const { Hunter } = require("../../models/users/Hunter");
const { getNumberEmoji } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string, Hunter]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId, hunter]) {
	const [{ maxSimBounties }] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
	const existingBounties = await database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" } });
	const occupiedSlots = existingBounties.map(bounty => bounty.slotNumber);
	const bountySlots = hunter.maxSlots(maxSimBounties);
	const slotOptions = [];
	for (let slotNumber = 1; slotNumber <= bountySlots; slotNumber++) {
		if (!occupiedSlots.includes(slotNumber)) {
			slotOptions.push({
				emoji: getNumberEmoji(slotNumber),
				label: `Slot ${slotNumber}`,
				description: `Reward: ${Bounty.calculateReward(hunter.level, slotNumber, 0)} XP`,
				value: slotNumber.toString()
			})
		}
	}

	if (slotOptions.length < 1) {
		interaction.reply({ content: "You don't seem to have any open bounty slots at the moment.", ephemeral: true });
		return;
	}

	interaction.reply({
		content: "You can post a bounty for other server members to help out with. Here's some examples:\n\t• __Party Up__ Get bounty hunters to join you for a game session\n\t• __WTB/WTS__ Get the word out your looking to trade\n\t• __Achievement Get__ Get help working toward an achievement\n\nTo make a bounty, you'll need:\n\t• a title\n\t• a description\nOptionally, you can also add:\n\t• a url for an image\n\t• a start and end time (to make an event to go with your bounty)\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId("bountypost")
					.setPlaceholder("XP awarded depends on slot used...")
					.setMaxValues(1)
					.setOptions(slotOptions)
			)
		],
		ephemeral: true
	});
};

module.exports = {
	data: {
		name: "post",
		description: "Post your own bounty (+1 XP)"
	},
	executeSubcommand
};
