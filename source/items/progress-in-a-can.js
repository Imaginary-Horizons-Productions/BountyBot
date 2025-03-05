const { userMention, MessageFlags } = require("discord.js");
const { ItemTemplate } = require("../classes");
const { Goal } = require("../models/companies/Goal");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Progress-in-a-Can";
module.exports = new ItemTemplate(itemName, "Add a contribution to the currently running Server Goal", 3000,
	async (interaction, database) => {
		const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId, state: "ongoing" } });
		if (!goal) {
			interaction.reply({ content: "There isn't currently a Server Goal running.", flags: [MessageFlags.Ephemeral] });
			return true;
		}
		const hunter = await logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id);
		const season = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
		const progressData = await logicLayer.goals.progressGoal(interaction.guildId, goal.type, hunter, season);
		const resultPayload = { content: `${userMention(interaction.user.id)}'s Progress-in-a-Can contributed ${progressData.gpContributed} GP the Server Goal!` };
		if (progressData.goalCompleted) {
			resultPayload.embeds = [Goal.generateCompletionEmbed(progressData.contributorIds)];
		}
		interaction.channel.send(resultPayload);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
