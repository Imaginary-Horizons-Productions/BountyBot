const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { commandMention } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const penaltyValue = Math.abs(interaction.options.get("penalty", true).value);
	const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId, state: "ongoing" } });
	if (!goal) {
		interaction.reply({ content: `There isn't an open Server Goal to penalize. You can use ${commandMention("moderation revoke-goal-bonus")} to revoke Goal Completion Item Find Bonus for bounty hunters.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	await database.models.Contribution.create({ goalId: goal.id, userId: interaction.user.id, value: -1 * penaltyValue });
	interaction.reply({ content: `The Server Goal's GP has been reduced by ${penaltyValue} GP.` });
};

module.exports = {
	data: {
		name: "gp-penalty",
		description: "Reduce the GP of the open Server Goal",
		optionsInput: [
			{
				type: "Integer",
				name: "penalty",
				description: "The amount of GP to subtract from the Server Goal",
				required: true
			}
		]
	},
	executeSubcommand
};
