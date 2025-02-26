const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Item } = require("./Item")

class Colorizer extends Item {
	/**
	 * @param {string} color
	 * @param {string} descriptionInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: CommandInteraction, database: Sequelize) => Promise<boolean>} effectFunction
	 */
	constructor(color) {
		const itemName = `${color} Profile Colorizer`;
		super(itemName, `Changes the color of your stats profile embed to ${color.toLowerCase()}`, 3000, 
			/** Sets the user's Hunter profile to Colors.Aqua in the used guild */
			async (interaction, database) => {
				database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(hunter => {
					hunter.profileColor = color.replace(/ /g, "");
					hunter.save();
				})
				interaction.reply({ content: `Your profile color has been set to ${color} in this server.`, flags: [MessageFlags.Ephemeral] });
			}
		);
	}
}

module.exports = {
	Colorizer
};
