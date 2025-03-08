const { ItemTemplate } = require("../classes");
const { getRankUpdates } = require("../util/scoreUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Legendary XP Boost";
const xpValue = 75;
module.exports = new ItemTemplate(itemName, `Gain ${xpValue} XP in the used server (unaffected by festivals)`, 60000,
	async (interaction, database) => {
		logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
			logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, xpValue);
			hunter.addXP(interaction.guild.name, xpValue, true, await logicLayer.companies.findCompanyByPK(interaction.guildId)).then(levelTexts => {
				getRankUpdates(interaction.guild, database, logicLayer).then(rankUpdates => {
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
