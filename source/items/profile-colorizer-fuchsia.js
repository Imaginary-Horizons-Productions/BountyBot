const { Item } = require("../classes");

const color = "Fuchsia";
const itemName = `${color} Profile Colorizer`;
module.exports = new Item(itemName, `Changes the color of your stats profile embed to ${color.toLowerCase()}`, 3000,
	/** Sets the user's Hunter profile to Colors.Fuchsia in the used guild */
	(interaction, database) => {
		database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(hunter => {
			hunter.profileColor = color;
			hunter.save();
		})
		interaction.reply({ content: `Your profile color has been set to ${color} in this server.`, ephemeral: true });
	}
);
