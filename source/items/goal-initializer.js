const { Item } = require("../classes");

const GOAL_TYPE_MAP = {
	bounties: { text: (count) => `complete ${count} bounties!`, coefficient: 1 },
	toasts: { text: (count) => `raise ${count} toasts!`, coefficient: 10 },
	secondings: { text: (count) => `second ${count} toasts!`, coefficient: 5 }
};

const itemName = "Goal Initializer";
module.exports = new Item(itemName, "Begin a Server Goal if there isn't already one running", 3000,
	async (interaction, database) => {
		const existingGoals = await database.models.Goal.findAll({ where: { companyId: interaction.guildId, state: "open" } });
		if (existingGoals.length > 0) {
			interaction.reply({ content: "This server already has a Server Goal running.", ephemeral: true });
			return true;
		}

		const eligibleTypes = ["bounties", "toasts", "secondings"];
		const goalType = eligibleTypes[Math.floor(Math.random() * eligibleTypes.length)];
		const previousSeason = database.models.Season.findOne({ where: { companyId: interaction.guildId, isPreviousSeason: true } });
		const activeHunters = previousSeason ? (await database.models.Participation.findOne({ where: { seasonId: season.id }, order: [["placement", "DESC"]] })).placement : 3;
		const requiredContributions = activeHunters * GOAL_TYPE_MAP[goalType].coefficient;
		await database.models.Goal.create({ companyId: interaction.guildId, type: goalType, requiredContributions });
		interaction.reply({ content: `${interaction.member} has started a Server Goal to ${GOAL_TYPE_MAP[goalType].text(requiredContributions)}` });
	}
);
