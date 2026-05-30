const { MessageLimits, GuildMemberLimits } = require("@sapphire/discord.js-utilities");

import { PremiumDictionary } from "../frontend/classes/PremiumDictionary";

import unparsedPremium from "../../config/premium.json";

// Conversion Factors
export const YEAR_IN_MS = 31556926000;
export const ZERO_WIDTH_WHITE_SPACE = "\u200B";

// JS Constants
export const MAX_SET_TIMEOUT = 2 ** 31 - 1;

// Discord Constants
export const serverGuideMention = "<id:guide>";
export const channelBrowserMention = "<id:customize>";
export const discordIconURL = "https://cdn.discordapp.com/attachments/618523876187570187/1110265047516721333/discord-mark-blue.png";

// Config
export { feedbackChannelId, testGuildId } from "../../config/auth.json";
export { announcementsChannelId, lastPostedVersion } from "../../config/versionData.json";
export const premium = new PremiumDictionary(unparsedPremium);
export const commandIds: Record<string, string> = {};

// Internal Constants
export const bountyBotIconURL = "https://cdn.discordapp.com/attachments/618523876187570187/1138968614364528791/BountyBotIcon.jpg";
export const BOUNTYBOT_INVITE_URL = "https://discord.com/oauth2/authorize?client_id=536330483852771348&permissions=2252135156869168&integration_type=0&scope=bot";
export const SAFE_DELIMITER = "→";
export const SKIP_INTERACTION_HANDLING = "❌";
export const COMPANY_XP_COEFFICIENT = 3;
export const GLOBAL_MAX_BOUNTY_SLOTS = MessageLimits.MaximumEmbeds;
export const MAX_EVERGREEN_SLOTS = MessageLimits.MaximumEmbeds;
export const GLOBAL_COMMAND_COOLDOWN = 2000; // in ms
export const MAX_BOT_NICKNAME_LENGTH = GuildMemberLimits.MaximumDisplayNameLength - 3; // We reserve 3 characters for festival tag nicknaming
