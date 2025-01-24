const { InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');

const mainId = "commands";
module.exports = new CommandWrapper(mainId, "Get a link to BountyBot's commands wiki", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Link the user to the repo Commands wiki page (automatically updated) */
	(interaction, database, runMode) => {
		interaction.reply({ content: "Here's a [link to the BountyBot Commands page](<https://github.com/Imaginary-Horizons-Productions/BountyBot/wiki/Commands>).", flags: [MessageFlags.Ephemeral] });
	}
);
