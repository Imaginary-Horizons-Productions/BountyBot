const { EmbedBuilder, userMention } = require("discord.js");
const { Item } = require("../classes");
const { progressGoal } = require("../logic/goals");
const { congratulationBuilder, listifyEN } = require("../util/textUtil");

const itemName = "Progress-in-a-Can";
module.exports = new Item(itemName, "Add a contribution to the currently running Server Goal", 3000,
	async (interaction, database) => {
		const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId, state: "ongoing" } });
		if (!goal) {
			interaction.reply({ content: "There isn't currently a Server Goal running.", ephemeral: true });
			return true;
		}
		const progressData = await progressGoal(interaction.guildId, goal.type, interaction.user.id, database);
		if (progressData.goalCompleted) {
			interaction.reply({
				embeds: [
					new EmbedBuilder().setTitle("Server Goal Completed")
						.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
						.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
						.addFields({ name: "Contributors", value: listifyEN(progressData.contributorIds.map(id => userMention(id))) })
				]
			});
		} else {
			interaction.reply({ content: `${userMention(interaction.user.id)}'s Progress-in-a-Can progressed the Server Goal!` });
		}
	}
);
