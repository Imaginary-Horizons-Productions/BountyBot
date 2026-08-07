import { MessageFlags, userMention } from "discord.js";
import { LogicLayer } from "../../logic";
import { ItemTemplate, ItemTemplateSet } from "../classes";
import { goalCompletionEmbed } from "../shared";

let logicLayer: LogicLayer;

const itemName = "Progress-in-a-Can";
export default new ItemTemplateSet(
	new ItemTemplate(itemName, "Add a contribution to the currently running Server Goal", 3000,
		async (interaction, theater) => {
			const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guild.id);
			if (!goal) {
				interaction.reply({ content: "There isn't currently a Server Goal running.", flags: MessageFlags.Ephemeral });
				return 0;
			}
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
			const { goalProgress } = await logicLayer.goals.progressGoal(theater.company, goal.type, theater.hunter, season);
			const resultPayload = { content: `${userMention(interaction.user.id)}'s Progress-in-a-Can contributed ${goalProgress.gpContributed} GP the Server Goal!` };
			if (goalProgress.goalCompleted) {
				resultPayload.embeds = [goalCompletionEmbed(goalProgress.contributorIds)];
			}
			interaction.channel.send(resultPayload);
			return 1;
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
