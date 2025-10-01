const { Client, ActivityType, IntentsBitField } = require("discord.js");

//TODONOW connect to db
//TODONOW login to Discord
const dAPIClient = new Client({
	retryLimit: 5,
	presence: {
		activities: [{
			type: ActivityType.Custom,
			name: "Maintenance: Updating bounty thread UI..."
		}]
	},
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages]
});

//TODONOW create list of bounty threads
//TODONOW remake bounty thread original posts
