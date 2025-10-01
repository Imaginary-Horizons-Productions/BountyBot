'use strict';
const { Client, ActivityType, IntentsBitField, Events, Guild } = require("discord.js");
const { generateBountyCommandSelect } = require("../source/frontend/shared");
const { Bounty } = require("../source/database/models");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const dAPIClient = new Client({
			retryLimit: 5,
			presence: {
				activities: [{
					type: ActivityType.Custom,
					name: "Maintenance: Updating bounty thread UI..."
				}]
			},
			intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages]
		});
		dAPIClient.login(require(__dirname + "/../config/auth.json").token);

		dAPIClient.on(Events.ClientReady, async () => {
			console.log(`Connected as ${dAPIClient.user.tag} -- Run Mode: redrawBountyThreads migration`);

			/** @type {Map<string, Bounty[]>} */
			const bountiesByGuild = new Map();

			const [bounties] = await queryInterface.sequelize.query("SELECT * FROM Bounty;");
			for (const bounty of bounties) {
				if (bounty.state === "open" && bounty.postingId) {
					if (bountiesByGuild.has(bounty.companyId)) {
						const guildBounties = bountiesByGuild.get(bounty.companyId);
						bountiesByGuild.set(bounty.companyId, guildBounties.concat(bounty));
					} else {
						bountiesByGuild.set(bounty.companyId, [bounty]);
					}
				}
			}

			/** @type {Map<string, Guild>} */
			const guildMap = new Map();
			for (const [companyId, bountyBundles] of bountiesByGuild) {
				const [result] = await queryInterface.sequelize.query(`SELECT bountyBoardId FROM Company WHERE id IS ${companyId};`);
				if (!guildMap.has(companyId)) {
					guildMap.set(companyId, await dAPIClient.guilds.fetch(companyId));
				}
				const guild = guildMap.get(companyId);
				const forum = await guild.channels.fetch(result[0]["bountyBoardId"]);
				for (const bounty of bountyBundles) {
					const thread = await forum.threads.fetch(bounty.postingId);
					const starterMessage = await thread.fetchStarterMessage();
					starterMessage.edit({ components: generateBountyCommandSelect(bounty.id) });
				}
			}
		})
	},
	async down(queryInterface, Sequelize) {
		//TODONOW revert to buttons
	}
};
