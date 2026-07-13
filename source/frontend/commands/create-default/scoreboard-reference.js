const { ChannelType, PermissionFlagsBits, OverwriteType, MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { seasonalScoreboardEmbed, overallScoreboardEmbed, isMissingPermissionError } = require("../../shared");

module.exports = new SubcommandWrapper("scoreboard-reference", "Create a reference channel with the BountyBot Scoreboard",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		let scoreboard;
		try {
			scoreboard = await interaction.guild.channels.create({
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
		} catch (error) {
			if (isMissingPermissionError(error)) {
				interaction.reply({ content: "Could not create a Scoreboard Reference Channel because BountyBot appears to be missing the `ManageChannels` permission.", flags: MessageFlags.Ephemeral });
				return;
			} else {
				console.error(error);
			}
		}
		const isSeasonal = interaction.options.getString("scoreboard-type") === "season";
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (isSeasonal) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
			embeds.push(await seasonalScoreboardEmbed(theater.company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(theater.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), goalProgress));
		}
		scoreboard.send({ embeds }).then(message => {
			theater.company.scoreboardChannelId = scoreboard.id;
			theater.company.scoreboardMessageId = message.id;
			theater.company.scoreboardIsSeasonal = isSeasonal;
			theater.company.save();
		});
		interaction.reply({ content: `A new scoreboard reference channel has been created: ${scoreboard}`, flags: MessageFlags.Ephemeral });
	}
).setOptions(
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
);
