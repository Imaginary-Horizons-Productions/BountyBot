const { Item } = require("../classes");
const { getRankUpdates } = require("../util/scoreUtil");

const itemName = "XP Boost";
const xpValue = 5;
module.exports = new Item(itemName, `Gain ${xpValue} XP in the used server (unaffected by festivals)`, 60000,
	async (interaction, database) => {
		database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(hunter => {
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
