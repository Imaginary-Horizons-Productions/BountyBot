const { MessageFlags } = require("discord.js");
const { Item } = require("../classes");

/** @type {typeof import("../logic")} */
let logicLayer;

const color = "Dark But Not Black";
const itemName = `${color} Profile Colorizer`;
module.exports = new Item(itemName, `Changes the color of your stats profile embed to ${color.toLowerCase()}`, 3000,
	/** Sets the user's Hunter profile to Colors.DarkButNotBlack in the used guild */
	async (interaction, database) => {
		logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(hunter => {
			hunter.profileColor = color.replace(/ /g, "");
			hunter.save();
		})
		interaction.reply({ content: `Your profile color has been set to ${color} in this server.`, flags: [MessageFlags.Ephemeral] });
	}
);

module.exports.setLogic = (logicBlob) => {
	logicLayer = logicBlob;
}
