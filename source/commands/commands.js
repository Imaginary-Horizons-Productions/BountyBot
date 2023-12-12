const { CommandWrapper } = require('../classes');

const mainId = "commands";
module.exports = new CommandWrapper(mainId, "Get a link to BountyBot's commands page", null, false, true, 3000,
	/** Link the user to the repo Commands wiki page (automatically updated) */
	(interaction, database, runMode) => {
		interaction.reply({ content: "Here's a [link to the BountyBot Commands page](<https://github.com/Imaginary-Horizons-Productions/BountyBot/wiki/Commands>).", ephemeral: true });
	}
);
