const { userMention, MessageFlags } = require("discord.js");
const { Item } = require("../classes");
const { progressGoal } = require("../logic/goals");
const { Goal } = require("../models/companies/Goal");

const itemName = "Progress-in-a-Can";
module.exports = new Item(itemName, "Add a contribution to the currently running Server Goal", 3000,
	async (interaction, database) => {
		const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId, state: "ongoing" } });
		if (!goal) {
			interaction.reply({ content: "There isn't currently a Server Goal running.", flags: [MessageFlags.Ephemeral] });
			return true;
		}
		const progressData = await progressGoal(interaction.guildId, goal.type, interaction.user.id);
		const resultPayload = { content: `${userMention(interaction.user.id)}'s Progress-in-a-Can contributed ${progressData.gpContributed} GP the Server Goal!` };
		if (progressData.goalCompleted) {
			resultPayload.embeds = [Goal.generateCompletionEmbed(progressData.contributorIds)];
		}
		interaction.channel.send(resultPayload);
	}
);
