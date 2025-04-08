const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { getRankUpdates } = require("../util/scoreUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Legendary XP Boost";
const xpValue = 75;
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, `Gain ${xpValue} XP in the used server (unaffected by festivals)`, 60000,
		async (interaction) => {
			logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
				logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, xpValue);
				const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
				const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
				const previousCompanyLevel = company.getLevel(allHunters);
				const previousHunterLevel = hunter.getLevel(company.xpCoefficient);
				await hunter.increment({ xp: xpValue }).then(hunter => hunter.reload());
				const rankUpdates = await getRankUpdates(interaction.guild, logicLayer);
				let result = `${interaction.member} used a ${itemName} and gained ${xpValue} XP.`;
				const hunterLevelLine = hunter.buildLevelUpLine(previousHunterLevel, company.xpCoefficient, company.maxSimBounties);
				if (hunterLevelLine) {
					rankUpdates.push(hunterLevelLine);
				}
				const reloadedHunters = await Promise.all(allHunters.map(hunter => {
					if (hunter.userId === interaction.user.id) {
						return hunter.reload();
					}
				}))
				const companyLevelLine = company.buildLevelUpLine(previousCompanyLevel, reloadedHunters, interaction.guild.name);
				if (companyLevelLine) {
					rankUpdates.push(companyLevelLine);
				}
				if (rankUpdates.length > 0) {
					result += `\n- ${rankUpdates.join("\n- ")}`;
				}
				interaction.reply({ content: result });
			})
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
