const { PermissionFlagsBits, InteractionContextType } = require("discord.js");
const { CommandWrapper } = require("../classes");
const { configCompanyThumbnails } = require("../shared/flows/configCompanyThumbnails");

const mainId = "config-server-thumbnails-premium";
const thumbnailUpdateData = [
	{
		label: "Scoreboard Thumbnail",
		description: "Set an image to use as thumbnail on the scoreboard",
		payloadProperty: "scoreboardThumbnailURL"
	},
	{
		label: "Goal Completion Thumbnail",
		description: "Set an image to use as thumbnail in server goal completion messages",
		payloadProperty: "goalCompletionThumbnailURL"
	},
	{
		label: "Raffle Thumbnail",
		description: "Set an image to use as thumbnail in raffle winner messages",
		payloadProperty: "raffleThumbnailURL"
	}
];
module.exports = new CommandWrapper(mainId, "Configure thumbnails for server messages (Premium)", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	async (interaction, theater, isDevMode) => {
		configCompanyThumbnails("Server Message Thumbnail", thumbnailUpdateData, interaction, theater.company);
	}
);
