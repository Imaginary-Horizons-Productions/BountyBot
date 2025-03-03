const { userMention, MessageFlags } = require("discord.js");
const { Item } = require("../classes");
const { Goal } = require("../models/companies/Goal");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Progress-in-a-Can";
module.exports = new Item(itemName, "Add a contribution to the currently running Server Goal", 3000,
	async (interaction, database) => {
		const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guild.id);
		if (!goal) {
			interaction.reply({ content: "There isn't currently a Server Goal running.", flags: [MessageFlags.Ephemeral] });
			return true;
		}
		const progressData = await logicLayer.goals.progressGoal(interaction.guildId, goal.type, interaction.user.id);
		const resultPayload = { content: `${userMention(interaction.user.id)}'s Progress-in-a-Can contributed ${progressData.gpContributed} GP the Server Goal!` };
		if (progressData.goalCompleted) {
			resultPayload.embeds = [Goal.generateCompletionEmbed(progressData.contributorIds)];
		}
		interaction.channel.send(resultPayload);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
