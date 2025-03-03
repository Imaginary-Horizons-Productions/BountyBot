const { MessageFlags } = require("discord.js");
const { Item } = require("../classes");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Goal Initializer";
module.exports = new Item(itemName, "Begin a Server Goal if there isn't already one running", 3000,
	async (interaction, database) => {
		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guildId);
		if (!!goal) {
			interaction.reply({ content: "This server already has a Server Goal running.", flags: [MessageFlags.Ephemeral] });
			return true;
		}

		const eligibleTypes = ["bounties", "toasts", "secondings"];
		const goalType = eligibleTypes[Math.floor(Math.random() * eligibleTypes.length)];
		const previousSeason = await logicLayer.seasons.findOneSeason(interaction.guildId, "previous");
		const activeHunters = previousSeason ? (await database.models.Participation.findOne({ where: { seasonId: season.id }, order: [["placement", "DESC"]] })).placement : 3;
		const requiredGP = activeHunters * 20;
		await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		await database.models.Goal.create({ companyId: interaction.guildId, type: goalType, requiredGP });
		interaction.channel.send(company.sendAnnouncement({ content: `${interaction.member} has started a Server Goal! This time **${goalType} are worth double GP**!` }));
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
