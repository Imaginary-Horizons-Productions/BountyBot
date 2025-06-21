const { MessageFlags } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");

/** @type {typeof import("../../logic")} */
let logicLayer;

class Colorizer extends ItemTemplate {
	/** @param {string} color */
	constructor(color) {
		const itemName = `${color} Profile Colorizer`;
		super(itemName, `Changes the color of your stats profile embed to ${color.toLowerCase()}`, 3000,
			/** Sets the user's Hunter profile to the specfied color in the used guild */
			async (interaction, origin) => {
				await logicLayer.hunters.setHunterProfileColor(interaction.user.id, interaction.guild.id, color.replace(/ /g, ""));
				interaction.reply({ content: `Your profile color has been set to ${color === "Default" ? "black" : color} in this server.`, flags: MessageFlags.Ephemeral });
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

module.exports = new ItemTemplateSet(...colors.map(color => new Colorizer(color)))
	.setLogicLinker((logicBlob) => {
		logicLayer = logicBlob;
	});
