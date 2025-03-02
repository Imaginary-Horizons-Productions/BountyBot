const { Item } = require("../classes");
const { getRankUpdates } = require("../util/scoreUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "XP Boost";
const xpValue = 5;
module.exports = new Item(itemName, `Gain ${xpValue} XP in the used server (unaffected by festivals)`, 60000,
	async (interaction, database) => {
		logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
			const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId: interaction.user.id, seasonId: season.id }, defaults: { xp: xpValue } });
			if (!participationCreated) {
				participation.increment({ xp: xpValue });
			}
			hunter.addXP(interaction.guild.name, xpValue, true, await logicLayer.companies.findCompanyByPK(interaction.guildId)).then(levelTexts => {
				getRankUpdates(interaction.guild, database).then(rankUpdates => {
					hunter.save();
					let result = `${interaction.member} used an XP Boost and gained ${xpValue} XP.`;
					const allMessages = rankUpdates.concat(levelTexts);
					if (allMessages.length > 0) {
						result += `\n- ${allMessages.join("\n- ")}`;
					}
					interaction.reply({ content: result });
				})
			});
		})
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
