const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../shared');

/** @type {typeof import("../../../logic")} */
let logicLayer;

const mainId = "bounty";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"complete.js",
	"edit.js",
	"list.js",
	"post.js",
	"revoke-turn-in.js",
	"showcase.js",
	"swap.js",
	"take-down.js",
	"verify-turn-in.js",
]);
module.exports = new CommandWrapper(mainId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	async (interaction, runMode) => {
		await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.user.id, interaction.guild.id);
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, runMode, logicLayer, hunter);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
