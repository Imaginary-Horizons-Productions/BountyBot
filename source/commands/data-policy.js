const { InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../classes');

const mainId = "data-policy";
module.exports = new CommandWrapper(mainId, "Get a link to BountyBot's data policy page", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Link the user to the repo Data Policy wiki page (automatically updated) */
	(interaction, database, runMode) => {
		interaction.reply({ content: "Here's a [link to the BountyBot Data Policy page](<https://github.com/Imaginary-Horizons-Productions/BountyBot/wiki/Data-Policy>).", ephemeral: true });
	}
);
