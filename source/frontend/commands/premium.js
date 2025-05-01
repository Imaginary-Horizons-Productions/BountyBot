const fs = require("fs");
const { EmbedBuilder, Colors, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { ihpAuthorPayload, randomFooterTip } = require("../shared");

const mainId = "premium";
module.exports = new CommandWrapper(mainId, "List perks for supporting IHP development", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	async (interaction, runMode) => {
		fs.promises.stat("./source/commands/premium.js").then(stats => {
			interaction.reply({
				embeds: [
					new EmbedBuilder().setColor(Colors.Blurple)
						.setAuthor(ihpAuthorPayload)
						.setTitle("BountyBot Premium Perks")
						.setThumbnail("https://cdn.discordapp.com/attachments/545684759276421120/734202424960745545/love-mystery.png")
						.setDescription("Thank you for using BountyBot! You can chip in for server costs and net some premium perks at the [BountyBot Github page](https://github.com/Imaginary-Horizons-Productions/BountyBot). Sponsors will also gain the following perks:")
						.addFields(
							{ name: "/evergreen", value: "Evergreen Bounties are posted by the server and aren't taken down when completed, making them ideal for server goals." },
							{ name: "/festival", value: "This command allows server admins to create BountyBot festivals that multiply all XP gained by a selected multiplier for their duration." },
							{ name: "/config-premium", value: "Premium configurations include configuring the multiplier applied to XP thresholds for bounty hunters to level up in the server and setting the maximum number of bounty slots bounty hunters can acquire." },
							{ name: "/rank", value: "This command allows server admins to customize the seasonal BountyBot ranks." }
						)
						.setFooter(randomFooterTip())
						.setTimestamp(stats.mtime)
				],
				flags: [MessageFlags.Ephemeral]
			});
		})
	}
);
