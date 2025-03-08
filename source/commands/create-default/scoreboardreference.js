const { CommandInteraction, ChannelType, PermissionFlagsBits, OverwriteType, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { buildSeasonalScoreboardEmbed, buildOverallScoreboardEmbed } = require("../../util/embedUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic"), Company]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer, company]) {
	const scoreboard = await interaction.guild.channels.create({
		parent: interaction.channel.parentId,
		name: "bountybot-scoreboard",
		type: ChannelType.GuildText,
		permissionOverwrites: [
			{
				id: interaction.client.user,
				allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages],
				type: OverwriteType.Member
			},
			{
				id: interaction.guildId,
				allow: [PermissionFlagsBits.ViewChannel],
				deny: [PermissionFlagsBits.SendMessages]
			}
		],
		reason: `/create-default scoreboard-reference by ${interaction.user}`
	});
	const isSeasonal = interaction.options.getString("scoreboard-type") == "season";
	scoreboard.send({
		embeds: [isSeasonal ? await buildSeasonalScoreboardEmbed(interaction.guild, logicLayer) : await buildOverallScoreboardEmbed(interaction.guild, database, logicLayer)]
	}).then(message => {
		company.scoreboardChannelId = scoreboard.id;
		company.scoreboardMessageId = message.id;
		company.scoreboardIsSeasonal = isSeasonal;
		company.save();
	});
	interaction.reply({ content: `A new scoreboard reference channel has been created: ${scoreboard}`, flags: [MessageFlags.Ephemeral] });
};

module.exports = {
	data: {
		name: "scoreboard-reference",
		description: "Create a reference channel with the BountyBot Scoreboard",
		optionsInput: [
			{
				type: "String",
				name: "scoreboard-type",
				description: "Pick if the scoreboard will show season XP or overall XP, only one updates",
				required: true,
				choices: [
					{ name: "Season Scoreboard", value: "season" },
					{ name: "Overall Scoreboard", value: "overall" }
				]
			}
		]
	},
	executeSubcommand
};
