const { PermissionFlagsBits, EmbedBuilder, Colors } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { randomFooterTip, ihpAuthorPayload } = require('../embedHelpers');

const customId = "premium";
const options = [];
const subcommands = [];
module.exports = new CommandWrapper(customId, "List perks for supporting IHP development", PermissionFlagsBits.ViewChannel, false, true, 3000, options, subcommands,
	/** List the premium features available for patrons */
	async (interaction) => {
		interaction.reply({
			embeds: [
				new EmbedBuilder().setColor(Colors.Blurple)
					.setAuthor(ihpAuthorPayload)
					.setTitle("BountyBot Premium Perks")
					.setURL("https://github.com/Imaginary-Horizons-Productions/BountyBot")
					.setThumbnail("https://cdn.discordapp.com/attachments/545684759276421120/734202424960745545/love-mystery.png")
					.setDescription("Thank you for using BountyBot! You can chip in for server costs and net some premium perks at the [BountyBot Github page](https://github.com/Imaginary-Horizons-Productions/BountyBot). All sponsers will see their tier noted in the \`/stats\` command. Sponsers at the Explorer Tier and higher will also enjoy the benefits listed below.")
					.addFields([
						{ name: "Premium Commands", value: "\`/max-bounties\`, \`/rankadd\`, \`/rankremove\`, \`/xpcoefficient\`" },
						{ name: "Premium Features", value: "*Scheduled Season Resets* - Premium users can set the season to end after a delay instead of immediately upon BountyBot receiving the command" }
					])
					.setFooter(randomFooterTip())
					.setTimestamp()
			],
			ephemeral: true
		});
	}
);
