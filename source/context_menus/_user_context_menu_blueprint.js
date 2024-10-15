const { PermissionFlagBits, InteractionContextType } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');

const mainId = "";
module.exports = new UserContextMenuWrapper(mainId, null, false, [ InteractionContextType.Guild ], 3000,
	/** Specs */
	(interaction, database, runMode) => {}
);
