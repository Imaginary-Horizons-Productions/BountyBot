const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "bounty";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"post.js",
	"edit.js",
	"swap.js",
	"showcase.js",
	"addcompleters.js",
	"removecompleters.js",
	"complete.js",
	"takedown.js",
	"list.js"
]);
module.exports = new CommandWrapper(mainId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	async (interaction, runMode) => {
		const userId = interaction.user.id;
		await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(userId, interaction.guild.id);
		if (hunter.isBanned) {
			interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, runMode, logicLayer, userId, hunter);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
