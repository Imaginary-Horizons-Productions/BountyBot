const { EmbedBuilder, userMention, MessageFlags } = require("discord.js");
const { Item } = require("../classes");
const { congratulationBuilder, listifyEN } = require("../util/textUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Progress-in-a-Can";
module.exports = new Item(itemName, "Add a contribution to the currently running Server Goal", 3000,
	async (interaction, database) => {
		const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId, state: "ongoing" } });
		if (!goal) {
			interaction.reply({ content: "There isn't currently a Server Goal running.", flags: [MessageFlags.Ephemeral] });
			return true;
		}
		const progressData = await logicLayer.goals.progressGoal(interaction.guildId, goal.type, interaction.user.id);
		const resultPayload = { content: `${userMention(interaction.user.id)}'s Progress-in-a-Can contributed ${progressData.gpContributed} GP the Server Goal!` };
		if (progressData.goalCompleted) {
			resultPayload.embeds = [
				new EmbedBuilder().setColor("e5b271")
					.setTitle("Server Goal Completed")
					.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
					.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
					.addFields({ name: "Contributors", value: listifyEN(progressData.contributorIds.map(id => userMention(id))) })
			];
		}
		interaction.channel.send(resultPayload);
	}
);

module.exports.setLogic = (logicBlob) => {
	logicLayer = logicBlob;
}
