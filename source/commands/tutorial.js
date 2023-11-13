const { EmbedBuilder, Colors } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { ihpAuthorPayload, randomFooterTip } = require('../util/embedUtil');
const { BOUNTYBOT_INVITE_URL } = require('../constants');

const mainId = "tutorial";
const options = [
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
];
const subcommands = [];
module.exports = new CommandWrapper(mainId, "Get tips for starting with BountyBot", null, false, true, 3000, options, subcommands,
	/** Send the user a embed with tips to start using BountyBot */
	(interaction, database, runMode) => {
		const embed = new EmbedBuilder().setColor(Colors.Blurple).setAuthor(ihpAuthorPayload)
			.setThumbnail(interaction.client.user.avatarURL())
			.setFooter(randomFooterTip());

		switch (interaction.options.getString(options[0].name)) {
			case options[0].choices[0].value: // hunter
				embed.setTitle("Bounty Hunter Starting Tips")
					.setDescription("BountyBot allows server members to post objectives as bounties and awards XP to the bounty hunters who complete them. Here's how you can get started:")
					.addFields(
						{ name: "Post a Bounty", value: "You can set up a bounty by using `/bounty post`. After the bounty is completed, credit the completers with `/bounty complete`." },
						{ name: "Raise a Toast", value: "You may want to thank someone for something you don't have a bounty for or congratulate someone for a job well done. The \`/toast\` command makes a nice message and grants the recipient XP!" },
						{ name: "Check for Posted Bounties", value: "Check if the server has a bounty board forum channel. Otherwise, you can use `/bounty list` to get lists of open bounties." },
						{ name: "Other Features", value: "To get a list of all BountyBot's commands, use `/commands`." }
					)
				break;
			case options[0].choices[1].value: // server
				embed.setTitle("Server Setup Tips")
					.setDescription("Following are some suggestions for setting up BountyBot on your server. NOTE: If you kick BountyBot, it will delete all data related to your server from the database.")
					.addFields(
						{ name: "Join Link", value: `Add BountyBot to your server with [this link](${BOUNTYBOT_INVITE_URL}).` },
						{ name: "/create-default", value: "The `/create-default` command can create a bounty board forum channel, a reference channel for the scoreboard, or roles for showing off seasonal ranks." },
						{ name: "/raffle announce-upcoming", value: "You can have BountyBot randomly select a user by seasonal rank or by level. Bounty hunters will likely appreciate if you announce the timing or eligibility for upcoming raffles ahead of time." },
						{ name: "/config-server", value: "You can set the notification type for BountyBot announcement messages (eg \"Should bounty posts start with @everyone, @here, etc?\")." },
						{ name: "/config-premium", value: "Premium members can change the XP coefficient for bounty hunter level-ups or the max number of slots a bounty hunter can have. Use `/premium` for more information." }
					)
				break;
		}

		interaction.reply({ embeds: [embed], ephemeral: true });
	}
);
