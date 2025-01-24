const { MessageFlags } = require("discord.js");
const { Item } = require("../classes");

const color = "Dark Gold";
const itemName = `${color} Profile Colorizer`;
module.exports = new Item(itemName, `Changes the color of your stats profile embed to ${color.toLowerCase()}`, 3000,
	/** Sets the user's Hunter profile to Colors.DarkGold in the used guild */
	async (interaction, database) => {
		database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(hunter => {
			hunter.profileColor = color.replace(/ /g, "");
			hunter.save();
		})
		interaction.reply({ content: `Your profile color has been set to ${color} in this server.`, flags: [MessageFlags.Ephemeral] });
	}
);
