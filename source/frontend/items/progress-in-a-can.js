const { userMention, MessageFlags } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { goalCompletionEmbed } = require("../shared");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "Progress-in-a-Can";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Add a contribution to the currently running Server Goal", 3000,
		async (interaction, origin) => {
			const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guild.id);
			if (!goal) {
				interaction.reply({ content: "There isn't currently a Server Goal running.", flags: MessageFlags.Ephemeral });
				return true;
			}
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
			const { goalProgress } = await logicLayer.goals.progressGoal(origin.company, goal.type, origin.hunter, season);
			const resultPayload = { content: `${userMention(interaction.user.id)}'s Progress-in-a-Can contributed ${goalProgress.gpContributed} GP the Server Goal!` };
			if (goalProgress.goalCompleted) {
				resultPayload.embeds = [goalCompletionEmbed(goalProgress.contributorIds)];
			}
			interaction.channel.send(resultPayload);
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
