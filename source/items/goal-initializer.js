const { MessageFlags } = require("discord.js");
const { Item } = require("../classes");
const { findOrCreateCompany } = require("../logic/companies");

const itemName = "Goal Initializer";
module.exports = new Item(itemName, "Begin a Server Goal if there isn't already one running", 3000,
	async (interaction, database) => {
		const [company] = await findOrCreateCompany(interaction.guild.id);
		const existingGoals = await database.models.Goal.findAll({ where: { companyId: interaction.guildId, state: "ongoing" } });
		if (existingGoals.length > 0) {
			interaction.reply({ content: "This server already has a Server Goal running.", flags: [MessageFlags.Ephemeral] });
			return true;
		}

		const eligibleTypes = ["bounties", "toasts", "secondings"];
		const goalType = eligibleTypes[Math.floor(Math.random() * eligibleTypes.length)];
		const previousSeason = await database.models.Season.findOne({ where: { companyId: interaction.guildId, isPreviousSeason: true } });
		const activeHunters = previousSeason ? (await database.models.Participation.findOne({ where: { seasonId: season.id }, order: [["placement", "DESC"]] })).placement : 3;
		const requiredGP = activeHunters * 20;
		await findOrCreateCompany(interaction.guild.id);
		await database.models.Goal.create({ companyId: interaction.guildId, type: goalType, requiredGP });
		interaction.channel.send(company.sendAnnouncement({ content: `${interaction.member} has started a Server Goal! This time **${goalType} are worth double GP**!` }));
	}
);
