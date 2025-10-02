'use strict';
const { Client, ActivityType, IntentsBitField, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { generateBountyCommandSelect } = require("../source/frontend/shared");
const { Bounty } = require("../source/database/models");
const { SAFE_DELIMITER } = require("../source/constants");
const { timeConversion } = require("../source/shared");

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
		return dAPIClient.login(require(__dirname + "/../config/auth.json").token).then(async () => {
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
			const dAPIPromises = [];
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
					dAPIPromises.push(starterMessage.edit({ components: generateBountyCommandSelect(bounty.id) }));
				}
			}
			return Promise.all(dAPIPromises);
		});
	},
	async down(queryInterface, Sequelize) {
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
		return dAPIClient.login(require(__dirname + "/../config/auth.json").token).then(async () => {
			console.log(`Connected as ${dAPIClient.user.tag} -- Run Mode: undo redrawBountyThreads migration`);

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
			const dAPIPromises = [];
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
					dAPIPromises.push(starterMessage.edit({
						components: [
							new ActionRowBuilder().addComponents(
								new ButtonBuilder().setCustomId(`bbcomplete${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Success)
									.setLabel("Complete")
									.setDisabled(new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))),
								new ButtonBuilder().setCustomId(`bbaddcompleters${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Primary)
									.setLabel("Credit Hunters"),
								new ButtonBuilder().setCustomId(`bbremovecompleters${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Secondary)
									.setLabel("Uncredit Hunters"),
								new ButtonBuilder().setCustomId(`bbshowcase${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Primary)
									.setLabel("Showcase this Bounty"),
								new ButtonBuilder().setCustomId(`bbtakedown${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Danger)
									.setLabel("Take Down")
							)
						]
					}));
				}
			}
			return Promise.all(dAPIPromises);
		});
	}
};
