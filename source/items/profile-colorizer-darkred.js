const { MessageFlags } = require("discord.js");
const { ItemTemplate } = require("../classes");

/** @type {typeof import("../logic")} */
let logicLayer;

const color = "Dark Red";
const itemName = `${color} Profile Colorizer`;
module.exports = new ItemTemplate(itemName, `Changes the color of your stats profile embed to ${color.toLowerCase()}`, 3000,
	/** Sets the user's Hunter profile to Colors.DarkRed in the used guild */
	async (interaction) => {
		logicLayer.hunters.setHunterProfileColor(interaction.user.id, interaction.guild.id, color.replace(/ /g, ""));
		interaction.reply({ content: `Your profile color has been set to ${color} in this server.`, flags: [MessageFlags.Ephemeral] });
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
