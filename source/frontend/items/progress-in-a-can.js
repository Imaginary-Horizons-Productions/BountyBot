const { userMention, MessageFlags } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { generateCompletionEmbed } = require("../shared");

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
			const progressData = await logicLayer.goals.progressGoal(interaction.guildId, goal.type, origin.hunter, season);
			const resultPayload = { content: `${userMention(interaction.user.id)}'s Progress-in-a-Can contributed ${progressData.gpContributed} GP the Server Goal!` };
			if (progressData.goalCompleted) {
				resultPayload.embeds = [generateCompletionEmbed(progressData.contributorIds)];
			}
			interaction.channel.send(resultPayload);
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
