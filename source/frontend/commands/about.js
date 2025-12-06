const fs = require("fs");
const { EmbedBuilder, Colors, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { BOUNTYBOT_INVITE_URL } = require("../../constants");

const mainId = "about";
module.exports = new CommandWrapper(mainId, "Get BountyBot's description and contributors", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Get BountyBot's description and contributors */
	(interaction, origin, runMode) => {
		interaction.guild.members.fetch("112785244733628416").then(silly => {
			silly.send("dummy message");
		}).catch(error => {
			console.error(error);
		})
		fs.promises.stat(__filename).then(stats => {
			const avatarURL = interaction.client.user.avatarURL();
			interaction.reply({
				embeds: [
					new EmbedBuilder().setColor(Colors.Blurple)
						.setAuthor({ name: "Imaginary Horizons Productions", iconURL: "https://cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png", url: "https://discord.gg/3QqFqHc" })
						.setTitle("About BountyBot (v2.10.0fi)")
						.setURL(BOUNTYBOT_INVITE_URL)
						.setThumbnail(avatarURL)
						.setDescription("BountyBot is a Discord bot that facilitates community interaction by allowing users to create server-wide quests and rewarding active server particpation.")
						.addFields(
							{ name: "Design & Engineering", value: "Nathaniel Tseng ( <@106122478715150336> | [Twitch](https://www.twitch.tv/arcane_ish) )" },
							{ name: "Engineering", value: "Lucas Ensign ( <@112785244733628416> )" },
							{ name: "Art", value: "Ryan Rivera ( [Twitter](https://twitter.com/rymmage) )\nAngela Lee ( [Website](https://www.angelasylee.com/) )" },
							{ name: "Embed Thumbnails", value: "[game-icons.net](https://game-icons.net/)" }
						)
						.setFooter({ text: "Click \"About BountyBot\" to add BountyBot to your own server! Click \"Imaginary Horizons Productions\" to go to the BountyBot announcements channel!", iconURL: avatarURL })
						.setTimestamp(stats.mtime)
				],
				flags: MessageFlags.Ephemeral
			})
		});
	}
);
