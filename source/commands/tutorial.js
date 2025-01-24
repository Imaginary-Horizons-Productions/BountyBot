const fs = require("fs");
const { EmbedBuilder, Colors, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { ihpAuthorPayload, randomFooterTip } = require('../util/embedUtil');
const { BOUNTYBOT_INVITE_URL } = require('../constants');
const { commandMention } = require('../util/textUtil');

const mainId = "tutorial";
module.exports = new CommandWrapper(mainId, "Get tips for starting with BountyBot", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Send the user a embed with tips to start using BountyBot */
	(interaction, database, runMode) => {
		fs.promises.stat("./source/commands/tutorial.js").then(stats => {
			const embed = new EmbedBuilder().setColor(Colors.Blurple).setAuthor(ihpAuthorPayload)
				.setThumbnail(interaction.client.user.avatarURL())
				.setFooter(randomFooterTip())
				.setTimestamp(stats.mtime);

			switch (interaction.options.getString("tutorial-type")) {
				case "hunter":
					embed.setTitle("Bounty Hunter Starting Tips")
						.setDescription("BountyBot allows server members to post objectives as bounties and awards XP to the bounty hunters who complete them. Here's how you can get started:")
						.addFields(
							{ name: "Post a Bounty", value: `You can set up a bounty by using ${commandMention("bounty post")}. After the bounty is completed, credit the completers with ${commandMention("bounty complete")}.` },
							{ name: "Raise a Toast", value: `You may want to thank someone for something you don't have a bounty for or congratulate someone for a job well done. The ${commandMention("toast")} command makes a nice message and grants the recipient XP!` },
							{ name: "Check for Posted Bounties", value: `Check if the server has a bounty board forum channel. Otherwise, you can use ${commandMention("bounty list")} to get lists of open bounties.` },
							{ name: "Other Features", value: `To get a list of all BountyBot's commands, use ${commandMention("commands")}.` }
						)
					break;
				case "server":
					embed.setTitle("Server Setup Tips")
						.setDescription("Following are some suggestions for setting up BountyBot on your server.\n\nNOTE: If you kick BountyBot, it will delete all data related to your server from the database.")
						.addFields(
							{ name: "Join Link", value: `Add BountyBot to your server with [this link](${BOUNTYBOT_INVITE_URL}).` },
							{ name: "/create-default", value: `This command group can create a bounty board forum channel (${commandMention("create-default bounty-board-forum")}), a reference channel for the scoreboard (${commandMention("create-default scoreboard-reference")}), or roles for showing off seasonal ranks (${commandMention("create-default rank-roles")}).` },
							{ name: commandMention("raffle announce-upcoming"), value: "You can have BountyBot randomly select a user by seasonal rank or by level. Bounty hunters will likely appreciate if you announce the timing or eligibility for upcoming raffles ahead of time." },
							{ name: commandMention("config-server"), value: "You can set the notification type for BountyBot announcement messages (eg \"Should bounty posts start with @everyone, @here, etc?\")." },
							{ name: commandMention("config-premium"), value: `Premium members can change the XP coefficient for bounty hunter level-ups or the max number of slots a bounty hunter can have. Use ${commandMention("premium")} for more information.` }
						)
					break;
			}

			interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
		})
	}
).setOptions(
	{
		type: "String",
		name: "tutorial-type",
		description: "Get starting bounty hunter tips or server setup tips",
		required: true,
		choices: [
			{ name: "Starting Bounty Hunter Tips", value: "hunter" },
			{ name: "Server Setup Tips", value: "server" }
		]
	}
);
