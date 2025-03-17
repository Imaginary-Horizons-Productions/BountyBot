const { MessageFlags } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Goal Initializer";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Begin a Server Goal if there isn't already one running", 3000,
		async (interaction) => {
			const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
			const goal = await logicLayer.goals.findCurrentServerGoal(interaction.guildId);
			if (!!goal) {
				interaction.reply({ content: "This server already has a Server Goal running.", flags: [MessageFlags.Ephemeral] });
				return true;
			}

			const eligibleTypes = ["bounties", "toasts", "secondings"];
			const goalType = eligibleTypes[Math.floor(Math.random() * eligibleTypes.length)];
			const previousSeason = await logicLayer.seasons.findOneSeason(interaction.guildId, "previous");
			const activeHunters = previousSeason ? await logicLayer.seasons.getParticipantCount(previousSeason.id) : 0;
			const requiredGP = Math.max(activeHunters * 20, 60);
			await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
			await logicLayer.goals.createGoal(interaction.guildId, goalType, requiredGP);
			interaction.channel.send(company.sendAnnouncement({ content: `${interaction.member} has started a Server Goal! This time **${goalType} are worth double GP**!` }));
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
