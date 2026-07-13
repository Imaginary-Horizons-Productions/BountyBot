const { PermissionFlagsBits, InteractionContextType } = require("discord.js");
const { CommandWrapper } = require("../classes");
const { configCompanyThumbnails } = require("../shared/flows/configCompanyThumbnails");

const mainId = "config-user-thumbnails-premium";
const thumbnailUpdateData = [
	{
		label: "Toast Thumbnail",
		description: "Set an image to use as thumbnail on toasts",
		payloadProperty: "toastThumbnailURL"
	},
	{
		label: "Open Bounty Thumbnail",
		description: "Set an image to use as thumbnail on open bounties",
		payloadProperty: "openBountyThumbnailURL"
	},
	{
		label: "Completed Bounty Thumbnail",
		description: "Set an image to use as thumbnail on completed bounties",
		payloadProperty: "completedBountyThumbnailURL"
	},
	{
		label: "Deleted Bounty Thumbnail",
		description: "Set an image to use as thumbnail on deleted bounties",
		payloadProperty: "deletedBountyThumbnailURL"
	}
];
module.exports = new CommandWrapper(mainId, "Configure thumbnails shown for Toasts and Bounties (Premium)", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	async (interaction, theater, isDevMode) => {
		configCompanyThumbnails("Bounty and Toast Message Thumbnail", thumbnailUpdateData, interaction, theater.company);
	}
);
