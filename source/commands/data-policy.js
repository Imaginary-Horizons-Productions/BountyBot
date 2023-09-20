const { CommandWrapper } = require('../classes');

const mainId = "data-policy";
const options = [];
const subcommands = [];
module.exports = new CommandWrapper(mainId, "Get a link to BountyBot's data policy page", null, false, true, 3000, options, subcommands,
	/** Link the user to the repo Data Policy wiki page (automatically updated) */
	(interaction) => {
		interaction.reply({ content: "Here's a link to the BountyBot Data Policy page (automatically updated): https://github.com/Imaginary-Horizons-Productions/BountyBot/wiki/Data-Policy", ephemeral: true });
	}
);
