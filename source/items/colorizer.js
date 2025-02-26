const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Item } = require("../classes");

class Colorizer extends Item {
	/**
	 * @param {string} color
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

const colors = [
	'Aqua',
	'Blue',
	'Blurple',
	'Dark Aqua',
	'Dark Blue',
	'Dark But Not Black',
	'Darker Grey',
	'Dark Gold',
	'Dark Green',
	'Dark Grey',
	'Dark Navy',
	'Dark Orange',
	'Dark Purple',
	'Dark Red',
	'Dark Vivid Pink',
	'Default',
	'Fuchsia',
	'Gold',
	'Green',
	'Grey',
	'Greyple',
	'Light Grey',
	'Luminous Vivid Pink',
	'Navy',
	'Not Quite Black',
	'Orange',
	'Purple',
	'Red',
	'White',
	'Yellow'
];

module.exports = colors.map(color => new Colorizer(color));
