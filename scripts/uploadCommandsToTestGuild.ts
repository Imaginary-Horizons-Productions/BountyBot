import { REST, Routes } from 'discord.js';
import auth from '../config/auth.json' with { type: "json" };
import { slashData } from '../source/frontend/commands/_commandDictionary.ts';
import { contextMenuData } from '../source/frontend/context_menus/_contextMenuDictionary.ts';

const { botId, testGuildId, token } = auth;
const rest = new REST({ version: "10" }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing slash commands on test guild.');

		await rest.put(
			Routes.applicationGuildCommands(botId, testGuildId),
			{ body: [...slashData, ...contextMenuData] },
		);

		console.log('Successfully reloaded slash commands on test guild.');
	} catch (error) {
		console.error(error);
	}
})();
