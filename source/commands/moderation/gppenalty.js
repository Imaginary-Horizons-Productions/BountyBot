const { MessageFlags } = require("discord.js");
const { commandMention } = require("../../util/textUtil");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("gp-penalty", "Reduce the GP of the open Server Goal",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const penaltyValue = Math.abs(interaction.options.get("penalty", true).value);
		const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guild.id);
		if (!goal) {
			interaction.reply({ content: `There isn't an open Server Goal to penalize. You can use ${commandMention("moderation revoke-goal-bonus")} to revoke Goal Completion Item Find Bonus for bounty hunters.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		await logicLayer.goals.createGoalContribution(goal.id, interaction.user.id, -1 * penaltyValue);
		interaction.reply({ content: `The Server Goal's GP has been reduced by ${penaltyValue} GP.` });
	}
).setOptions(
	{
		type: "Integer",
		name: "penalty",
		description: "The amount of GP to subtract from the Server Goal",
		required: true
	}
);
