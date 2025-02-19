const { MessageFlags } = require("discord.js");
const { Item } = require("../classes");
const { findOneHunter } = require("../logic/hunters");

const color = "Greyple";
const itemName = `${color} Profile Colorizer`;
module.exports = new Item(itemName, `Changes the color of your stats profile embed to ${color.toLowerCase()}`, 3000,
	/** Sets the user's Hunter profile to Colors.Greyple in the used guild */
	async (interaction, database) => {
		findOneHunter(interaction.user.id, interaction.guild.id).then(hunter => {
			hunter.profileColor = color;
			hunter.save();
		})
		interaction.reply({ content: `Your profile color has been set to ${color} in this server.`, flags: [MessageFlags.Ephemeral] });
	}
);
