const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { commandMention } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const penaltyValue = Math.abs(interaction.options.get("penalty", true).value);
	const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guild.id);
	if (!goal) {
		interaction.reply({ content: `There isn't an open Server Goal to penalize. You can use ${commandMention("moderation revoke-goal-bonus")} to revoke Goal Completion Item Find Bonus for bounty hunters.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	await logicLayer.goals.createGoalContribution(goal.id, interaction.user.id, -1 * penaltyValue);
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
