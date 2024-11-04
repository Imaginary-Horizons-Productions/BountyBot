const { Item } = require("../classes");
const { progressGoal } = require("../logic/goals");

const itemName = "Progress-in-a-Can";
module.exports = new Item(itemName, "Add a contribution to the currently running Server Goal", 3000,
	async (interaction, database) => {
		const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId, state: "ongoing" } });
		if (!goal) {
			interaction.reply({ content: "There isn't currently a Server Goal running.", ephemeral: true });
			return true;
		}
		interaction.reply({ content: await progressGoal(interaction.guildId, goal.type, interaction.user.id, database) });
	}
);
