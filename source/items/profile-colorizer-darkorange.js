const { MessageFlags } = require("discord.js");
const { ItemTemplate } = require("../classes");

/** @type {typeof import("../logic")} */
let logicLayer;

const color = "Dark Orange";
const itemName = `${color} Profile Colorizer`;
module.exports = new ItemTemplate(itemName, `Changes the color of your stats profile embed to ${color.toLowerCase()}`, 3000,
	/** Sets the user's Hunter profile to Colors.DarkOrange in the used guild */
	async (interaction, database) => {
		logicLayer.hunters.setHunterProfileColor(interaction.user.id, interaction.guild.id, color.replace(/ /g, ""));
		interaction.reply({ content: `Your profile color has been set to ${color} in this server.`, flags: [MessageFlags.Ephemeral] });
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
