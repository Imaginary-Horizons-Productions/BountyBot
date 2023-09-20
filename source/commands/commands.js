const { CommandWrapper } = require('../classes');

const mainId = "commands";
const options = [];
const subcommands = [];
module.exports = new CommandWrapper(mainId, "Get a link to BountyBot's commands page", null, false, true, 3000, options, subcommands,
	/** Link the user to the repo Commands wiki page (automatically updated) */
	(interaction) => {
		interaction.reply({ content: "Here's a link to the BountyBot Commands page (automatically updated): https://github.com/Imaginary-Horizons-Productions/BountyBot/wiki/Commands", ephemeral: true });
	}
);
