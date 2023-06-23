const { PermissionFlagsBits, EmbedBuilder, Colors } = require('discord.js');
const { CommandWrapper } = require('../classes');

const customId = "about";
const options = [];
const subcommands = [];
module.exports = new CommandWrapper(customId, "Get BountyBot's description and contributors", PermissionFlagsBits.ViewChannel, false, true, 3000, options, subcommands,
	/** Get BountyBot's description and contributors */
	(interaction) => {
		const avatarURL = interaction.client.user.avatarURL();
		interaction.reply({
			embeds: [
				new EmbedBuilder().setColor(Colors.Blurple)
					.setAuthor({ name: "Imaginary Horizons Productions", iconURL: "https://cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png", url: "https://discord.gg/3QqFqHc" })
					.setTitle(`About BountyBot`)
					.setURL(`https://discord.com/api/oauth2/authorize?client_id=536330483852771348&permissions=67300416&scope=bot`)
					.setThumbnail(avatarURL)
					.setDescription(`BountyBot allows server members to post objectives as bounties and awards XP to the bounty hunters who complete them.`)
					.addFields(
						{ name: "Design & Engineering", value: "Nathaniel Tseng ( <@106122478715150336> | [Twitch](https://www.twitch.tv/arcane_ish) )" },
						{ name: "Engineering", value: "Lucas Ensign ( <@112785244733628416> | [Twitter](https://twitter.com/SillySalamndr) )" },
						{ name: "Art", value: "Ryan Rivera ( [Twitter](https://twitter.com/rymmage) )\nAngela Lee ( [Website](https://www.angelasylee.com/) )" },
						{ name: "Embed Thumbnails", value: "[game-icons.net](https://game-icons.net/)" }
					)
					.setFooter({ text: "Click \"About BountyBot\" to add BountyBot to your own server! Click \"Imaginary Horizons Productions\" to go to the BountyBot announcements channel!", iconURL: avatarURL })
					.setTimestamp()
			],
			ephemeral: true
		})
	}
);
