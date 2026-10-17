import { MessageFlags, bold } from "discord.js";
import type { LogicLayer } from "../../logic";
import { GoalProgressKind } from "../../shared/types.ts";
import { ItemTemplate, ItemTemplateSet } from "../classes/index.ts";
import { addCompanyAnnouncementPrefix } from "../shared/index.ts";

let logicLayer: LogicLayer;

const itemName = "Goal Initializer";
export default new ItemTemplateSet(
	new ItemTemplate(itemName, "Begin a Server Goal if there isn't already one running", 3000,
		async (interaction, theater) => {
			const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guildId);
			if (!!goal) {
				interaction.reply({ content: "This server already has a Server Goal running.", flags: MessageFlags.Ephemeral });
				return 0;
			}

			const eligibleTypes = [GoalProgressKind.Bounty, GoalProgressKind.Toast, GoalProgressKind.Seconding];
			const goalType = eligibleTypes[Math.floor(Math.random() * eligibleTypes.length)];
			const previousSeason = await logicLayer.seasons.findOneSeason(interaction.guildId, "previous");
			const activeHunters = previousSeason ? await logicLayer.seasons.getParticipantCount(previousSeason.id) : 0;
			const requiredGP = Math.max(activeHunters * 20, 60);
			await logicLayer.goals.createGoal(interaction.guildId, goalType, requiredGP);
			interaction.channel.send(addCompanyAnnouncementPrefix(theater.company, { content: `${interaction.member} has started a Server Goal! Completing bounties, raising toasts, and seconding toasts on this server contributes Goal Points (GP) toward completing the goal.\n\nThis time, ${bold(`${goalType} are worth double GP`)}!` }));
			return 1;
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
