import { MessageFlags, SlashCommandIntegerOption } from "discord.js";
import { SubcommandFunctionality } from "../../classes";
import { commandMention } from "../../shared";

const penaltyOption = new SlashCommandIntegerOption().setName("penalty")
	.setDescription("The amount of GP to subtract from the Server Goal")
	.setRequired(true);

export default new SubcommandFunctionality("gp-penalty", "Reduce the GP of the open Server Goal",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const penaltyValue = Math.abs(interaction.options.getInteger(penaltyOption.name, true));
		const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guild.id);
		if (!goal) {
			interaction.reply({ content: `There isn't an open Server Goal to penalize. You can use ${commandMention("moderation revoke-goal-bonus")} to revoke Goal Completion Item Find Bonus for bounty hunters.`, flags: MessageFlags.Ephemeral });
			return;
		}
		await logicLayer.goals.createGoalContribution(goal.id, interaction.user.id, -1 * penaltyValue);
		interaction.reply({ content: `The Server Goal's GP has been reduced by ${penaltyValue} GP.` });
	}
).setOptions(penaltyOption);
