const { MessageFlags } = require("discord.js");
const { Item } = require("../classes");

const color = "Default";
const itemName = `${color} Profile Colorizer`;
module.exports = new Item(itemName, "Changes the color of your stats profile embed to black", 3000,
	/** Sets the user's Hunter profile to Colors.Default in the used guild */
	async (interaction, database) => {
		database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(hunter => {
			hunter.profileColor = color;
			hunter.save();
		})
		interaction.reply({ content: `Your profile color has been set to black in this server.`, flags: [MessageFlags.Ephemeral] });
	}
);
