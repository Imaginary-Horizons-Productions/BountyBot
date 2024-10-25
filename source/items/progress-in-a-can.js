const { Op } = require("sequelize");
const { Item } = require("../classes");

const itemName = "Progress in a Can";
module.exports = new Item(itemName, "Add a contribution to the currently running Server Goal", 3000,
	async (interaction, database) => {
		const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId, state: "open" } });
		if (!goal) {
			interaction.reply({ content: "There isn't currently a Server Goal running.", ephemeral: true });
			return true;
		}
		await database.models.Contributions.create({ goalId: goal.id, userId: interaction.user.id });
		await database.models.Hunter.update("goalContributions", { where: { companyId: interaction.guildId, userId: interaction.user.id } });
		const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
		await database.models.Participation.upsert("goalContributions", { where: { companyId: interaction.guildId, userId: interaction.user.id, seasonId: season.id } });
		const contributions = await database.models.Contributions.findAll({ where: { goalId: goal.id } });
		if (goal.requiredContributions <= contributions.length) {
			const dedupedContributorIds = [...new Set(contributions.map(contribution => contribution.userId))];
			database.models.Hunter.update({ itemFindBoost: true }, { where: { userId: { [Op.in]: dedupedContributorIds } } });
			goal.update("state", "completed");
			interaction.reply({ content: `${interaction.member} completed the Server Goal with their Progress-in-a-Can! ${listifyEN(dedupedContributorIds.map(id => userMention(id)))} gained an Item Find Boost for their next bounty completion!` });
		} else {
			interaction.reply({ content: `${userMention(userId)} used a Progress-in-a-Can to contribute to the Server Goal!` });
		}
	}
);
