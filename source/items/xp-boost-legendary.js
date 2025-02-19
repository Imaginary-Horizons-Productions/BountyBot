const { Item } = require("../classes");
const { findOneHunter } = require("../logic/hunters");
const { findOrCreateCurrentSeason } = require("../logic/seasons");
const { getRankUpdates } = require("../util/scoreUtil");

const itemName = "Legendary XP Boost";
const xpValue = 75;
module.exports = new Item(itemName, `Gain ${xpValue} XP in the used server (unaffected by festivals)`, 60000,
	async (interaction, database) => {
		findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
			const [season] = await findOrCreateCurrentSeason(interaction.guildId);
			const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId: interaction.user.id, seasonId: season.id }, defaults: { xp: xpValue } });
			if (!participationCreated) {
				participation.increment({ xp: xpValue });
			}
			hunter.addXP(interaction.guild.name, xpValue, true, database).then(levelTexts => {
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
);
